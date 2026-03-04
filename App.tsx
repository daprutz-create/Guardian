// App.tsx — Guardian v4
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Text } from 'react-native';

import ScanScreen from './src/screens/ScanScreen';
import DevicesScreen from './src/screens/DevicesScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeviceDetailScreen from './src/screens/DeviceDetailScreen';
import RequestDesignerScreen from './src/screens/RequestDesignerScreen';
import NFCScreen from './src/screens/NFCScreen';
import IRScreen from './src/screens/IRScreen';
import BLEScreen from './src/screens/BLEScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#080c0a', borderTopColor: '#1a2e20', borderTopWidth: 1, height: 60, paddingBottom: 4 },
      tabBarActiveTintColor: '#00ff6a',
      tabBarInactiveTintColor: '#2a4a30',
      tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' },
    }}>
      <Tab.Screen name="Scan" component={ScanScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 18 }}>📡</Text> }} />
      <Tab.Screen name="NFC" component={NFCScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 18 }}>💳</Text> }} />
      <Tab.Screen name="BLE" component={BLEScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔵</Text> }} />
      <Tab.Screen name="IR" component={IRScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 18 }}>📺</Text> }} />
      <Tab.Screen name="Security" component={SecurityScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 18 }}>🛡️</Text> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚙️</Text> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#080c0a" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="DeviceDetail" component={DeviceDetailScreen} />
          <Stack.Screen name="RequestDesigner" component={RequestDesignerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
