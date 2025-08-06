import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Import screens
import { LoginScreen, InventoryScreen, AddItemScreen } from './src/screens';
import EditItemScreen from './src/screens/EditItemScreen'; // Add this import

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
            headerLeft: () => null,
            gestureEnabled: false,
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="AddItem" 
          component={AddItemScreen}
          options={{ title: 'Add New Item' }}
        />
        <Stack.Screen 
          name="EditItemScreen" 
          component={EditItemScreen}
          options={{ 
            title: 'Edit Item',
            headerShown: false
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
