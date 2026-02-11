import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Game Header */}
        <View style={styles.header}>
          <View style={styles.teamsContainer}>
            <View style={styles.teamSide}>
              <View style={styles.teamLogo}>
                <Text style={styles.logoEmoji}>🏀</Text>
              </View>
              <Text style={styles.teamName}>Home Team</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>0 - 0</Text>
              <Text style={styles.gameStatus}>Final</Text>
            </View>
            <View style={styles.teamSide}>
              <View style={styles.teamLogo}>
                <Text style={styles.logoEmoji}>🏀</Text>
              </View>
              <Text style={styles.teamName}>Away Team</Text>
            </View>
          </View>
          <Text style={styles.gameDate}>February 10, 2026 • 7:00 PM</Text>
        </View>

        {/* Box Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Box Score</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Game ID: {id}
            </Text>
            <Text style={styles.placeholderText}>
              Connect to Firebase to load box score
            </Text>
          </View>
        </View>

        {/* Play-by-Play */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Play-by-Play</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Connect to Firebase to load play-by-play
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f1a",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: "#1a1a2e",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d44",
  },
  teamsContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  teamSide: {
    flex: 1,
    alignItems: "center",
  },
  teamLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2d2d44",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 28,
  },
  teamName: {
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  scoreContainer: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  score: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  gameStatus: {
    fontSize: 12,
    color: "#f59e0b",
    marginTop: 4,
    textTransform: "uppercase",
  },
  gameDate: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  placeholderCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 4,
  },
});
