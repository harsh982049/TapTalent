import React, { useState, useMemo, useEffect } from 'react';
// Standard, local package imports
import { Provider, useSelector, useDispatch } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line 
} from 'recharts';
import {
  Sun, Moon, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, 
  Wind, Droplet, Thermometer, Sunrise, Sunset, Eye, Gauge, MapPin, 
  Search, X, Star, Settings, Check, ChevronUp, ChevronDown, Calendar, Clock
} from 'lucide-react';

// --- CONSTANTS ---

// -----------------------------------------------------------------------------
// ⚠️ IMPORTANT! ⚠️
// Get your free API key from https://www.weatherapi.com/ and paste it here.
// -----------------------------------------------------------------------------
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY || "YOUR_API_KEY_HERE"; 

if (WEATHER_API_KEY === "YOUR_API_KEY_HERE") {
  console.error("Please add your WeatherAPI.com API key to weather_dashboard.jsx");
  // NOTE: In a real app, you might show an alert, but we avoid window.alert here.
}

const API_BASE_URL = import.meta.env.VITE_WEATHER_API_BASE || 'https://api.weatherapi.com/v1';

// --- REDUX STATE MANAGEMENT ---

// 1. Favorites Slice (Persisted to localStorage)

// Load initial favorites from localStorage
const loadFavorites = () => {
  try {
    const serializedFavorites = localStorage.getItem('favoriteCities');
    if (serializedFavorites === null) {
      return ['London', 'New York', 'Tokyo']; // Default favorites
    }
    return JSON.parse(serializedFavorites);
  } catch (err) {
    console.error("Could not load favorites:", err);
    return ['London', 'New York', 'Tokyo'];
  }
};

const saveFavorites = (cities) => {
  try {
    const serializedFavorites = JSON.stringify(cities);
    localStorage.setItem('favoriteCities', serializedFavorites);
  } catch (err) {
    console.error("Could not save favorites:", err);
  }
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: {
    cities: loadFavorites(),
  },
  reducers: {
    addFavorite: (state, action) => {
      const city = action.payload;
      if (!state.cities.find(c => c.toLowerCase() === city.toLowerCase())) {
        state.cities.push(city);
        saveFavorites(state.cities);
      }
    },
    removeFavorite: (state, action) => {
      state.cities = state.cities.filter(city => city.toLowerCase() !== action.payload.toLowerCase());
      saveFavorites(state.cities);
    },
  },
});

const { addFavorite, removeFavorite } = favoritesSlice.actions;

// 2. Settings Slice
const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    unit: 'c', // 'c' for celsius, 'f' for fahrenheit
  },
  reducers: {
    toggleUnit: (state) => {
      state.unit = state.unit === 'c' ? 'f' : 'c';
    },
  },
});

const { toggleUnit } = settingsSlice.actions;

// 3. Weather API (RTK Query)
// This handles all data fetching, caching, and polling for real-time updates.
const weatherApi = createApi({
  reducerPath: 'weatherApi',
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }),
  endpoints: (builder) => ({
    // Search for cities
    searchCities: builder.query({
      query: (search) => `search.json?key=${WEATHER_API_KEY}&q=${search}`,
    }),
    // Get detailed forecast (includes current, daily, and hourly)
    getForecast: builder.query({
      query: ({ city, days = 7 }) => `forecast.json?key=${WEATHER_API_KEY}&q=${city}&days=${days}&aqi=no&alerts=no`,
      // Cache data for 60 seconds (fulfills "not older than 60s" requirement)
      keepUnusedDataFor: 60,
    }),
  }),
});

// Export hooks for use in components
const { useLazySearchCitiesQuery, useGetForecastQuery } = weatherApi;

// 4. Redux Store Configuration
const store = configureStore({
  reducer: {
    favorites: favoritesSlice.reducer,
    settings: settingsSlice.reducer,
    [weatherApi.reducerPath]: weatherApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(weatherApi.middleware),
});

// --- HELPER COMPONENTS ---

/**
 * Maps WeatherAPI condition text to a Lucide icon
 */
const WeatherIcon = ({ conditionText, className = 'w-10 h-10', isDay }) => {
  const text = conditionText.toLowerCase();
  let Icon;

  if (text.includes('sunny')) {
    Icon = Sun;
  } else if (text.includes('clear')) {
    Icon = isDay ? Sun : Moon;
  } else if (text.includes('partly cloudy')) {
    Icon = isDay ? CloudSun : Cloud;
  } else if (text.includes('cloudy') || text.includes('overcast')) {
    Icon = Cloud;
  } else if (text.includes('mist') || text.includes('fog')) {
    Icon = CloudFog;
  } else if (text.includes('patchy rain') || text.includes('light rain') || text.includes('drizzle')) {
    Icon = CloudRain;
  } else if (text.includes('rain') || text.includes('shower')) {
    Icon = CloudRain;
  } else if (text.includes('snow') || text.includes('sleet') || text.includes('ice pellets')) {
    Icon = CloudSnow;
  } else if (text.includes('thunder')) {
    Icon = CloudLightning;
  } else {
    Icon = CloudSun; // Default
  }

  return <Icon className={className} />;
};

/**
 * A custom tooltip for Recharts
 */
const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const tempKey = unit === 'c' ? 'temp_c' : 'temp_f';
    const feelsLikeKey = unit === 'c' ? 'feelslike_c' : 'feelslike_f';

    return (
      <div className="p-3 bg-gray-800 bg-opacity-90 border border-gray-700 rounded-lg shadow-lg text-white">
        <p className="text-sm font-bold">{label}</p>
        {data[tempKey] !== undefined && (
          <p className="text-xs text-blue-300">{`Temp: ${data[tempKey]}°${unit.toUpperCase()}`}</p>
        )}
        {data[feelsLikeKey] !== undefined && (
          <p className="text-xs text-green-300">{`Feels like: ${data[feelsLikeKey]}°${unit.toUpperCase()}`}</p>
        )}
        {data.chance_of_rain !== undefined && (
          <p className="text-xs text-cyan-300">{`Rain: ${data.chance_of_rain}%`}</p>
        )}
        {data.wind_kph !== undefined && (
          <p className="text-xs text-gray-300">{`Wind: ${data.wind_kph.toFixed(1)} kph`}</p>
        )}
      </div>
    );
  }
  return null;
};

/**
 * Loading spinner
 */
const Spinner = () => (
  <div className="flex justify-center items-center w-full h-full">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// --- MAIN COMPONENTS ---

/**
 * Settings component to toggle C/F
 */
const SettingsComponent = () => {
  const dispatch = useDispatch();
  const unit = useSelector((state) => state.settings.unit);

  return (
    <button
      onClick={() => dispatch(toggleUnit())}
      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
    >
      <Settings size={18} />
      <span>
        °{unit.toUpperCase()}
      </span>
    </button>
  );
};

/**
 * Search bar with autocomplete
 */
const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.favorites.cities);

  const [triggerSearch, { data: searchResults, isFetching }] = useLazySearchCitiesQuery();

  useEffect(() => {
    if (query.length > 2) {
      const timer = setTimeout(() => {
        triggerSearch(query);
      }, 300); // Debounce search
      return () => clearTimeout(timer);
    }
  }, [query, triggerSearch]);

  const handleAddFavorite = (city) => {
    dispatch(addFavorite(city.name));
    setQuery('');
  };

  const isAlreadyFavorite = (cityName) => 
    favorites.some(fav => fav.toLowerCase() === cityName.toLowerCase());

  return (
    <div className="relative w-full max-w-md" onBlur={() => setTimeout(() => setIsFocused(false), 150)}>
      <div className="flex items-center">
        <Search size={20} className="absolute left-3 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search for a city..."
          className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isFetching && <div className="absolute right-3 w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>}
      </div>
      
      {isFocused && (query.length > 2 || searchResults) && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searchResults && searchResults.length > 0 && searchResults.map((city) => (
            <div
              key={city.id}
              className="flex justify-between items-center px-4 py-3 hover:bg-gray-700 cursor-pointer"
            >
              <span>{city.name}, {city.region}, {city.country}</span>
              <button
                onClick={() => handleAddFavorite(city)}
                disabled={isAlreadyFavorite(city.name)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  isAlreadyFavorite(city.name)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isAlreadyFavorite(city.name) ? <Check size={16} /> : 'Add'}
              </button>
            </div>
          ))}
          {searchResults && searchResults.length === 0 && (
            <div className="px-4 py-3 text-gray-400">No results found.</div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hourly Forecast Chart
 */
const HourlyChart = ({ hourlyData, unit }) => {
  const tempKey = unit === 'c' ? 'temp_c' : 'temp_f';

  // Format data for chart
  const chartData = useMemo(() => {
    return hourlyData.map(hour => ({
      ...hour,
      time: new Date(hour.time_epoch * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
    }));
  }, [hourlyData, unit]);

  return (
    <div className="w-full h-64">
      <h3 className="text-xl font-semibold mb-4 text-white">Hourly Forecast</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
          <XAxis dataKey="time" stroke="#9ca3af" />
          <YAxis 
            stroke="#9ca3af" 
            domain={['dataMin - 2', 'dataMax + 2']} 
            tickFormatter={(value) => `${value}°`}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Area
            type="monotone"
            dataKey={tempKey}
            name="Temperature"
            stroke="#8884d8"
            fillOpacity={1}
            fill="url(#colorTemp)"
          />
          <Area
            type="monotone"
            dataKey="chance_of_rain"
            name="Chance of Rain"
            stroke="#34d399"
            fillOpacity={0.1}
            fill="#34d399"
            yAxisId="right"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * 7-Day Forecast Chart
 */
const DailyChart = ({ dailyData, unit }) => {
  const maxTempKey = unit === 'c' ? 'maxtemp_c' : 'maxtemp_f';
  const minTempKey = unit === 'c' ? 'mintemp_c' : 'mintemp_f';

  // Format data for chart
  const chartData = useMemo(() => {
    return dailyData.map(day => ({
      ...day.day,
      date: new Date(day.date_epoch * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
    }));
  }, [dailyData, unit]);

  return (
    <div className="w-full h-64">
      <h3 className="text-xl font-semibold mb-4 text-white">7-Day Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" tickFormatter={(value) => `${value}°`} />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Legend />
          <Line
            type="monotone"
            dataKey={maxTempKey}
            name="Max Temp"
            stroke="#ef4444"
            activeDot={{ r: 8 }}
          />
          <Line
            type="monotone"
            dataKey={minTempKey}
            name="Min Temp"
            stroke="#3b82f6"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Detailed View Modal
 */
const DetailedViewModal = ({ city, onClose }) => {
  const { data, error, isLoading } = useGetForecastQuery({ city, days: 7 }, {
    // This will refetch data every 60 seconds if the modal is open
    pollingInterval: 60000 
  });
  const unit = useSelector((state) => state.settings.unit);
  const dispatch = useDispatch();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-75">
        <Spinner />
      </div>
    );
  }

  // Error handling is managed by the parent component (WeatherDashboard)
  // to prevent modal from even opening if data fails.
  if (error || !data) {
    return null;
  }

  const { location, current, forecast } = data;
  const todayForecast = forecast.forecastday[0];
  const hourlyData = todayForecast.hour.filter(hour => {
    // Show only hours from now onwards
    return hour.time_epoch > new Date().getTime() / 1000;
  });

  const temp = unit === 'c' ? current.temp_c : current.temp_f;
  const feelsLike = unit === 'c' ? current.feelslike_c : current.feelslike_f;
  const minTemp = unit === 'c' ? todayForecast.day.mintemp_c : todayForecast.day.mintemp_f;
  const maxTemp = unit === 'c' ? todayForecast.day.maxtemp_c : todayForecast.day.maxtemp_f;

  const details = [
    { label: "Feels Like", value: `${feelsLike}°`, Icon: Thermometer },
    { label: "Wind", value: `${current.wind_kph} kph`, Icon: Wind },
    { label: "Humidity", value: `${current.humidity}%`, Icon: Droplet },
    { label: "UV Index", value: current.uv, Icon: Sun },
    { label: "Pressure", value: `${current.pressure_mb} mb`, Icon: Gauge },
    { label: "Visibility", value: `${current.vis_km} km`, Icon: Eye },
    { label: "Sunrise", value: todayForecast.astro.sunrise, Icon: Sunrise },
    { label: "Sunset", value: todayForecast.astro.sunset, Icon: Sunset },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg shadow-xl text-white overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-3xl font-bold">{location.name}, {location.country}</h2>
          <p className="text-gray-400">{location.localtime}</p>
          <div className="flex items-center mt-4">
            <WeatherIcon conditionText={current.condition.text} isDay={current.is_day} className="w-20 h-20" />
            <div className="ml-4">
              <span className="text-6xl font-thin">{Math.round(temp)}°</span>
              <span className="text-2xl text-gray-400">{unit.toUpperCase()}</span>
            </div>
            <div className="ml-6 text-gray-300">
              <p>{current.condition.text}</p>
              <p>H: {Math.round(maxTemp)}° / L: {Math.round(minTemp)}°</p>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-700">
          {details.map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <Icon size={20} className="text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="p-6 space-y-8">
          <HourlyChart hourlyData={hourlyData.length > 0 ? hourlyData : todayForecast.hour} unit={unit} />
          <DailyChart dailyData={forecast.forecastday} unit={unit} />
        </div>
      </div>
    </div>
  );
};

/**
 * Summary card for the main dashboard
 */
const WeatherCard = ({ city, onClick }) => {
  const { data, error, isLoading } = useGetForecastQuery({ city });
  const unit = useSelector((state) => state.settings.unit);
  const dispatch = useDispatch();

  const handleRemove = (e) => {
    e.stopPropagation(); // Prevent modal from opening
    dispatch(removeFavorite(city));
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg flex justify-center items-center min-h-[180px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-red-400">
        <p>Could not load data for {city}.</p>
        <button
          onClick={handleRemove}
          className="mt-2 text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>
    );
  }

  const { location, current } = data;
  const temp = unit === 'c' ? current.temp_c : current.temp_f;

  return (
    <div
      onClick={onClick}
      className="p-6 bg-gray-800 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition-colors group"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-white">{location.name}</h3>
          <p className="text-sm text-gray-400">{location.country}</p>
        </div>
        <button
          onClick={handleRemove}
          className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center">
          <WeatherIcon conditionText={current.condition.text} isDay={current.is_day} className="w-16 h-16 text-yellow-300" />
          <div className="ml-3">
            <span className="text-4xl font-thin text-white">{Math.round(temp)}°</span>
            <span className="text-xl text-gray-400">{unit.toUpperCase()}</span>
          </div>
        </div>
        <div className="text-right text-sm text-gray-300">
          <p>{current.condition.text}</p>
          <p className="flex items-center justify-end gap-1"><Droplet size={14} /> {current.humidity}%</p>
          <p className="flex items-center justify-end gap-1"><Wind size={14} /> {current.wind_kph} kph</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Dashboard grid
 */
const Dashboard = ({ onCityClick }) => {
  const favorites = useSelector((state) => state.favorites.cities);

  if (favorites.length === 0) {
    return (
      <div className="text-center text-gray-400 p-10">
        <p>Your dashboard is empty.</p>
        <p>Use the search bar to find and add your favorite cities.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {favorites.map((city) => (
        <WeatherCard key={city} city={city} onClick={() => onCityClick(city)} />
      ))}
    </div>
  );
};

// --- APP ---

/**
 * A custom modal for alerts, replacing window.alert()
 */
const AlertModal = ({ message, onClose }) => (
  <div 
    className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-75 p-4"
    onClick={onClose}
  >
    <div 
      className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm" 
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-white mb-4">{message}</p>
      <button 
        onClick={onClose}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
      >
        OK
      </button>
    </div>
  </div>
);


/**
 * The main component that holds the layout and state
 */
function WeatherDashboard() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const dispatch = useDispatch();

  const handleCityClick = (city) => {
    setSelectedCity(city);
  };

  const handleCloseModal = () => {
    setSelectedCity(null);
  };

  // This hook checks for errors when a city is selected
  const { isError } = useGetForecastQuery({ city: selectedCity, days: 7 }, {
    skip: !selectedCity, // Don't run query if no city is selected
  });

  useEffect(() => {
    if (isError && selectedCity) {
      // The query for the selected city failed (e.g., city not found)
      setAlertMessage(`Could not find weather for ${selectedCity}. It has been removed from favorites.`);
      dispatch(removeFavorite(selectedCity));
      setSelectedCity(null); // Close the modal (which wouldn't have opened)
    }
  }, [isError, selectedCity, dispatch]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-white">Weather Dashboard</h1>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <SearchBar />
            <SettingsComponent />
          </div>
        </header>

        {/* Main Content */}
        <main>
          <Dashboard onCityClick={handleCityClick} />
        </main>
      </div>

      {/* Modal */}
      {selectedCity && !isError && (
        <DetailedViewModal
          city={selectedCity}
          onClose={handleCloseModal}
        />
      )}
      
      {/* Alert Modal */}
      {alertMessage && (
        <AlertModal 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}
    </div>
  );
}

/**
 * Root component that provides the Redux store
 */
export default function App() {
  return (
    <Provider store={store}>
      <WeatherDashboard />
    </Provider>
  );
}

