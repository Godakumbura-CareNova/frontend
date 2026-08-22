import apiClient from './apiClient';

export const profileApi = {
  getProfile: async () => {
    const response = await apiClient.get('/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await apiClient.put('/profile', profileData);
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await apiClient.post('/profile/change-password', passwordData);
    return response.data;
  },
};

export default profileApi;
