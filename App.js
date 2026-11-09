import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import DreamScreen from "./screens/DreamScreen";
import TodoScreen from "./screens/TodoScreen";
import CallsScreen from "./screens/CallsScreen";
import CounterScreen from "./screens/CounterScreen";
import TabBar from "./components/TabBar";
import { colors } from "./theme";

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          initialRouteName="Dream"
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{ headerShown: false }}
          screenListeners={({ navigation, route }) => ({
            // Re-tapping the already-active tab returns to Todo — mirrors the
            // web FE, where clicking an active view button toggles back to todo.
            tabPress: (e) => {
              if (route.name !== "Todo" && navigation.isFocused()) {
                e.preventDefault();
                navigation.navigate("Todo");
              }
            },
          })}
        >
          <Tab.Screen name="Dream" component={DreamScreen} />
          <Tab.Screen name="Todo" component={TodoScreen} />
          <Tab.Screen name="Calls" component={CallsScreen} />
          <Tab.Screen name="Counter" component={CounterScreen} />
        </Tab.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
