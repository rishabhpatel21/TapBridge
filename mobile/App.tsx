import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ConnectionScreen from './src/screens/ConnectionScreen';
import LauncherScreen from './src/screens/LauncherScreen';
import { AppProviders } from './src/state/AppProviders';
import { useTheme } from './src/theme/ThemeContext';

export type RootStackParamList = {
  Connection: undefined;
  Launcher: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppShell = () => {
  const { colors, scheme } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg
    }
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Connection"
        screenOptions={{
          headerShown: false,
          animation: 'fade'
        }}
      >
        <Stack.Screen name="Connection" component={ConnectionScreen} />
        <Stack.Screen name="Launcher" component={LauncherScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <AppShell />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
