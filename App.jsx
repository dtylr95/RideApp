import React, { useEffect, useMemo, useState } from "react";
import { Bike, MapPin, Search, Settings2, RefreshCw, CloudRain, Wind, Thermometer, LocateFixed, CheckCircle2, AlertTriangle, Sun, Cloud, CloudDrizzle } from "lucide-react";

const DEFAULTS = { minTemp: 8, maxTemp: 22, maxWind: 18, maxGust: 30, rainTolerance: 20 };
const mph = (kmh) => kmh * 0.621371;

function scoreWeather({ temp, wind, gust, rain, code }, p) {
  const tempScore = temp < p.minTemp
    ? Math.max(0, 10 - (p.minTemp - temp) * 1.5)
    : temp > p.maxTemp ? Math.max(2, 10 - (temp - p.maxTemp) * 1.2) : 10;
  const bandScore = (value, limit) => value <= limit * 0.65 ? 10 : value <= limit ? 7 : value <= limit * 1.5 ? 3 : 0;
  const rainScore = rain <= p.rainTolerance * 0.6 ? 10 : rain <= p.rainTolerance ? 7 : rain <= Math.max(p.rainTolerance, 65) ? 3 : 0;
  let score = (tempScore + bandScore(wind, p.maxWind) + bandScore(gust, p.maxGust) + rainScore) / 4;
  const hazardous = [95, 96, 99].includes(code) || gust >= 45;
  if (hazardous) score = Math.min(score, 2);
  return { score: Math.round(score * 10) / 10, hazardous, parts: [
    { label: temp >= p.minTemp && temp <= p.maxTemp ? "Temperature suits your preferences" : "Temperature is outside your preferred range", good: temp >= p.minTemp && temp <= p.maxTemp },
    { label: wind <= p.maxWind ? "Wind is within your preferred limit" : "Wind exceeds your preferred limit", good: wind <= p.maxWind },
    { label: gust <= p.maxGust ? "Gusts are within your preferred limit" : "Gusts exceed your preferred limit", good: gust <= p.maxGust },
    { label: rain <= p.rainTolerance ? "Rain chance is within your tolerance" : "Rain chance exceeds your tolerance", good: rain <= p.rainTolerance }
  ]};
}

function weatherDescription(code) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Mostly clear";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Variable";
}

export default function App() {
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("rideready-prefs") || "{}") }; }
    catch { return DEFAULTS; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [placeInput, setPlaceInput] = useState("");
  const [locationName, setLocationName] = useState("");
  const [coords, setCoords] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");

  useEffect(() => { localStorage.setItem("rideready-prefs", JSON.stringify(prefs)); }, [prefs]);

  async function fetchWeather(lat, lon, name) {
    setLoading(true); setError("");
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: lat, longitude: lon,
        current: "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
        hourly: "precipitation_probability",
        forecast_days: "1", timezone: "auto"
      }).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Weather service could not be reached. Please try again.");
      const data = await response.json();
      const current = data.current;
      const hourIndex = data.hourly.time.findIndex(t => t.slice(0, 13) === current.time.slice(0, 13));
      const rain = hourIndex >= 0 ? (data.hourly.precipitation_probability[hourIndex] ?? 0) : 0;
      setWeather({
        temp: current.temperature_2m,
        wind: mph(current.wind_speed_10m),
        gust: mph(current.wind_gusts_10m),
        rain,
        code: current.weather_code,
        description: weatherDescription(current.weather_code)
      });
      setCoords({ lat, lon }); setLocationName(name); setUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { setError(e.message || "Unable to load the forecast."); }
    finally { setLoading(false); }
  }

  function locateMe() {
    setError("");
    if (!navigator.geolocation) { setError("This browser doesn't support location. Search for your town instead."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      p => fetchWeather(p.coords.latitude, p.coords.longitude, "Your current location"),
      () => { setLoading(false); setError("We couldn't access your location. Allow location access in your browser, or search for a town below."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  }

  async function searchPlace(e) {
    e?.preventDefault();
    if (!placeInput.trim()) return;
    setLoading(true); setError("");
    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.search = new URLSearchParams({ name: placeInput.trim(), count: "1", language: "en", format: "json" }).toString();
      const response = await fetch(url);
      const data = await response.json();
      if (!data.results?.length) throw new Error("We couldn't find that place. Try a nearby town or city.");
      const p = data.results[0];
      await fetchWeather(p.latitude, p.longitude, [p.name, p.admin1, p.country].filter(Boolean).join(", "));
    } catch (e) { setLoading(false); setError(e.message || "Location search failed."); }
  }

  const result = useMemo(() => weather ? scoreWeather(weather, prefs) : null, [weather, prefs]);
  const verdict = !result ? "Waiting for forecast" : result.hazardous ? "Stay in" : result.score >= 7.5 ? "Great day to ride" : result.score >= 5 ? "Maybe ride" : "Probably stay in";
  const verdictClass = !result ? "" : result.hazardous || result.score < 5 ? "bad" : result.score >= 7.5 ? "good" : "maybe";

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><Bike size={23}/></span><div><h1>RideReady</h1><p>Your weather. Your ride.</p></div></div>
      <button className="icon-button" onClick={() => setShowSettings(v => !v)} aria-label="Preferences"><Settings2 size={19}/><span>Preferences</span></button>
    </header>

    <section className="location-card card">
      <div className="location-line"><div><span className="eyebrow">YOUR LOCATION</span><strong><MapPin size={15}/>{locationName || "Choose your location"}</strong></div>
        <button className="outline-button" onClick={locateMe} disabled={loading}><LocateFixed size={16}/> Locate me</button>
      </div>
      <form className="search-form" onSubmit={searchPlace}>
        <input value={placeInput} onChange={e => setPlaceInput(e.target.value)} placeholder="Or enter a town, city or postcode" aria-label="Search location"/>
        <button className="outline-button" type="submit" disabled={loading || !placeInput.trim()}><Search size={16}/> Search</button>
      </form>
      {error && <p className="error-message"><AlertTriangle size={15}/>{error}</p>}
      {loading && <p className="loading-message">Getting your local forecast…</p>}
    </section>

    {showSettings && <section className="card settings-card">
      <div className="section-heading"><div><span className="eyebrow">PERSONALISE YOUR FORECAST</span><h2>Weather preferences</h2></div><button className="text-button" onClick={() => setShowSettings(false)}>Done</button></div>
      <Preference label="Minimum temperature" value={prefs.minTemp} min={-5} max={20} suffix="°C" onChange={v => setPrefs(p => ({...p,minTemp:v}))}/>
      <Preference label="Maximum temperature" value={prefs.maxTemp} min={5} max={40} suffix="°C" onChange={v => setPrefs(p => ({...p,maxTemp:v}))}/>
      <Preference label="Maximum comfortable wind" value={prefs.maxWind} min={5} max={35} suffix=" mph" onChange={v => setPrefs(p => ({...p,maxWind:v}))}/>
      <Preference label="Maximum comfortable gusts" value={prefs.maxGust} min={10} max={55} suffix=" mph" onChange={v => setPrefs(p => ({...p,maxGust:v}))}/>
      <label className="field-label" htmlFor="rain">Rain tolerance</label>
      <select id="rain" value={prefs.rainTolerance} onChange={e => setPrefs(p => ({...p,rainTolerance:Number(e.target.value)}))}>
        <option value="0">No rain</option><option value="20">Light rain acceptable</option><option value="60">Moderate rain acceptable</option><option value="100">Any rain acceptable</option>
      </select>
      {prefs.minTemp > prefs.maxTemp && <p className="error-message">Minimum temperature must not exceed maximum temperature.</p>}
    </section>}

    <section className="card verdict-card">
      <div className="verdict-top"><span className="eyebrow">YOUR CYCLING VERDICT</span><span className="updated">{updated ? `Updated ${updated}` : "Live forecast"}</span></div>
      <div className={`verdict-title ${verdictClass}`}>{verdict}</div>
      <div className="score-line"><strong>{result ? result.score.toFixed(1) : "—"}</strong><span>/ 10 suitability score</span></div>
      <div className="score-track"><span style={{width:`${result ? result.score * 10 : 0}%`}} className={verdictClass}/></div>
      <p className="verdict-summary">{!result ? "Choose your location to see whether the weather suits your ride." : result.hazardous ? "Potentially hazardous conditions detected. Consider indoor training and check official weather warnings." : result.score >= 7.5 ? "Conditions look favourable based on your personal preferences." : result.score >= 5 ? "There are a few compromises to consider before heading out." : "The weather is outside much of your comfort zone today."}</p>
      <div className="weather-grid">
        <Metric icon={<Thermometer/>} label="Temperature" value={weather ? `${weather.temp.toFixed(1)}°C` : "—"}/>
        <Metric icon={<Wind/>} label="Wind" value={weather ? `${weather.wind.toFixed(0)} mph` : "—"}/>
        <Metric icon={<CloudRain/>} label="Rain chance" value={weather ? `${weather.rain}%` : "—"}/>
        <Metric icon={<Wind/>} label="Wind gusts" value={weather ? `${weather.gust.toFixed(0)} mph` : "—"}/>
      </div>
      {weather && <div className="conditions"><span>{weather.description}</span><span>Current conditions</span></div>}
      <div className="reason-block"><h3>Why this verdict?</h3>{result ? result.parts.map((part,i)=><div className="reason" key={i}><span className={part.good ? "reason-good" : "reason-warn"}>{part.good ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}</span>{part.label}</div>) : <p className="subtle">Your weather analysis will appear here.</p>}{result?.hazardous && <p className="safety-note">Severe weather or very strong gusts detected. This score is not a substitute for official warnings or your own judgement.</p>}</div>
      <button className="refresh-button" onClick={() => coords && fetchWeather(coords.lat, coords.lon, locationName)} disabled={loading || !coords}><RefreshCw size={17} className={loading ? "spin" : ""}/>{loading ? "Refreshing…" : "Refresh forecast"}</button>
    </section>
    <footer>Weather data by Open-Meteo · RideReady is an experimental guide, not a safety assessment.</footer>
  </main>;
}

function Preference({label,value,min,max,suffix,onChange}) {
  return <div className="preference"><div className="preference-label"><label>{label}</label><strong>{value}{suffix}</strong></div><input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}/></div>;
}
function Metric({icon,label,value}) {
  return <div className="metric"><div className="metric-label">{icon}<span>{label}</span></div><strong>{value}</strong></div>;
}
