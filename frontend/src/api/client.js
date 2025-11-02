import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const client = axios.create({ baseURL, withCredentials: true })

// send credentials (cookies) for anon free-generation enforcement
client.defaults.withCredentials = true

export default client
