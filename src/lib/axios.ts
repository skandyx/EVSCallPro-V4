import axios from 'axios';

const isServer = typeof window === 'undefined';
const getToken = () => !isServer ? localStorage.getItem('authToken') : null;

// La baseURL est intentionnellement laissée vide. La construction de l'URL complète
// est désormais gérée de manière explicite dans l'intercepteur de requêtes pour
// une robustesse maximale et pour éviter les erreurs de construction d'URL internes à Axios.
const apiClient = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/* ------- REQUEST INTERCEPTOR ------- */
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Cette logique garantit que chaque requête a une URL absolue complète, ce qui est
    // le correctif définitif pour l'erreur "Failed to construct 'URL': Invalid URL".
    let path = config.url || '';
    if (!path.startsWith('/api')) {
      path = `/api${path.startsWith('/') ? '' : '/'}${path}`;
    }
    
    if (!isServer) {
        // Transformer le chemin relatif (ex: /api/users) en URL absolue
        config.url = new URL(path, window.location.origin).href;
    } else {
        // Fallback pour les environnements non-navigateur (non utilisé dans ce projet)
        config.url = `http://localhost:3001${path}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ------- RESPONSE INTERCEPTOR ------- */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // L'URL de la requête de rafraîchissement est maintenant absolue, la vérification doit donc s'adapter.
    const isRefreshRequest = originalRequest.url.endsWith('/api/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;

      try {
        // L'intercepteur se chargera de transformer '/auth/refresh' en une URL complète.
        const { data } = await apiClient.post('/auth/refresh'); 
        
        if (!isServer) {
          localStorage.setItem('authToken', data.accessToken);
        }
        
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        
        // L'URL de la requête originale est déjà absolue, il suffit de la réexécuter.
        return apiClient(originalRequest);

      } catch (refreshError) {
        if (!isServer) {
          localStorage.removeItem('authToken');
          window.dispatchEvent(new CustomEvent('logoutEvent'));
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
