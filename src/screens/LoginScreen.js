import React, { useState } from 'react';
import { Image, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import logo from '../../public/logo.png';
import { useOAuth, useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { useWarmUpBrowser } from '../utils/warmUpBrowser';

export default function LoginScreen() {
  useWarmUpBrowser();
  const navigation = useNavigation();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_microsoft' });
  const { isSignedIn, signOut } = useAuth();
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    if (oauthLoading) return;
    try {
      setOauthLoading(true);

      // sign out if a session is already active
      if (isSignedIn) {
        await signOut();
      }

      const { createdSessionId, setActive } = await startOAuthFlow({
        preferEphemeralSession: true,
      });

      if (createdSessionId) {
        await setActive({ session: createdSessionId });
        navigation.replace('Inventory');
      }
    } catch (err) {
      Alert.alert('Microsoft Login Error', err.message);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <Text style={styles.heading}>Inventory App</Text>

      <TouchableOpacity
        onPress={handleMicrosoftLogin}
        disabled={oauthLoading}
        style={[styles.oauthButton, oauthLoading && { opacity: 0.5 }]}
      >
        <Text style={styles.oauth}>
          {oauthLoading ? 'Logging in...' : 'Login with Microsoft'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    alignSelf: 'center',
    marginBottom: 36,
  },
  oauthButton: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  oauth: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0078d4',
  },
  logo: {
    width: 160,
    height: 100,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 10,
  },
});
