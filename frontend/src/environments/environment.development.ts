export const environment = {
  production: false,
  // Requests go through the gateway (8081) which forwards to Core API.
  // For direct Core API access bypassing the gateway, use http://localhost:8099/api
  apiBaseUrl: 'http://localhost:8081/api'
};
