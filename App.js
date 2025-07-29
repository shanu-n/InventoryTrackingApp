import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Import screens
import { LoginScreen, InventoryScreen, AddItemScreen } from './src/screens';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2563eb',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Inventory" 
          component={InventoryScreen}
          options={{ 
            title: 'My Inventory',
            headerLeft: () => null, // Disable back button
            gestureEnabled: false,  // Optional: disables swipe back
          }}
        />
        <Stack.Screen 
          name="AddItem" 
          component={AddItemScreen}
          options={{ title: 'Add New Item' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
