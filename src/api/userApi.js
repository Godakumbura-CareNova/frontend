import apiClient from './apiClient';

export const userApi = {
  getAllUsers: async (search) => {
    const response = await apiClient.get('/admin/users', {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  getUserById: async (id) => {
    const response = await apiClient.get(`/admin/users/${id}`);
    return response.data;
  },

  updateUserRole: async (id, role) => {
    const response = await apiClient.patch(`/admin/users/${id}/role`, { role });
    return response.data;
  },

  toggleUserStatus: async (id, isActive) => {
    const response = await apiClient.patch(`/admin/users/${id}/status`, { isActive });
    return response.data;
  },
};

export default userApi;
