import React, { useState } from 'react';
import { Image } from 'react-native';
import logo from '../assets/logo.png'; // adjust path if needed

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  useSignIn,
  useOAuth,
  useUser,
  useAuth,
} from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { signIn, setActive } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_microsoft' });
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleEmailLogin = async () => {
    try {
      setLoadingEmail(true);
      const result = await signIn.create({
        identifier: email,
        password,
      });

      await setActive({ session: result.createdSessionId });
      navigation.replace('Inventory');
    } catch (err) {
      Alert.alert('Login Failed', err.errors?.[0]?.message || 'Something went wrong');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (oauthLoading) return;
    try {
      setOauthLoading(true);

      // sign out if session is active
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
  <Image
    source={logo}
    style={styles.logo}
  />

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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#007aff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    marginVertical: 20,
    textAlign: 'center',
    color: '#777',
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
  signupText: {
    marginTop: 24,
    color: '#007aff',
    textAlign: 'center',
    fontSize: 15,
  },
  logo: {
    width: 160,     // reduced from 160
    height: 100,     // reduced to make it more compact
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 10,
  },
  
});
