// Preloads and releases the in-app browser to make OAuth logins open faster
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

export const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};
