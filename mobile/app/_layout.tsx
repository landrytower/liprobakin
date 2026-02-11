import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#1a1a2e",
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "bold",
            },
            contentStyle: {
              backgroundColor: "#0f0f1a",
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="team/[id]" options={{ title: "Team" }} />
          <Stack.Screen name="player/[id]" options={{ title: "Player" }} />
          <Stack.Screen name="game/[id]" options={{ title: "Game" }} />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
