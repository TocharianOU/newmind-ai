import { createContext, useContext, useState, useEffect } from 'react';
import api from '../config/api';

const defaults = {
  billingEnabled:            true,
  ssoEnabled:                true,
  auditExportEnabled:        true,
  enterpriseFeaturesEnabled: false,
  enabledSSOProviders:       [],
};

const FeatureFlagsContext = createContext(defaults);

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export const FeatureFlagsProvider = ({ children }) => {
  const [flags, setFlags] = useState(defaults);

  useEffect(() => {
    api.get('/api/auth/flags')
      .then(res => {
        if (res.data?.status === 'success') {
          setFlags({ ...defaults, ...res.data.data });
        }
      })
      .catch(() => {
        // fallback to defaults on network error
      });
  }, []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};
