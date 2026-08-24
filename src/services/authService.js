import apiClient from './api';

export const registerCustomer = async (payload) => {
  const response = await apiClient.post('/auth/register', payload);
  return response.data;
};

export default {
  registerCustomer,
};
