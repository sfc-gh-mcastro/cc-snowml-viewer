import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { GraphData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useGraphData() {
  return useQuery<GraphData>({
    queryKey: ['graph'],
    queryFn: async () => {
      const response = await axios.get<GraphData>(`${API_URL}/api/graph`);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
