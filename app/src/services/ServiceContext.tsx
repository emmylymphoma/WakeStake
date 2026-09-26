import { createContext, useContext, type ReactNode } from 'react';
import type { Services } from './types';

const ServiceContext = createContext<Services | null>(null);

export function ServiceProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServiceContext);
  if (!services) throw new Error('useServices() must be used inside <ServiceProvider>');
  return services;
}
