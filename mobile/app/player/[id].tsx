import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Player Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={styles.playerName}>Player Name</Text>
          <Text style={styles.playerInfo}>#00 • Position</Text>
          <Text style={styles.teamName}>Team Name</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Season Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>0.0</Text>
              <Text style={styles.statLabel}>PPG</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>0.0</Text>
              <Text style={styles.statLabel}>RPG</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>0.0</Text>
              <Text style={styles.statLabel}>APG</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Player Bio</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Player ID: {id}
            </Text>
            <Text style={styles.placeholderText}>
              Connect to Firebase to load player data
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
    padding: 32,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d44",
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2d2d44",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  playerName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  playerInfo: {
    fontSize: 16,
    color: "#f59e0b",
    marginTop: 4,
  },
  teamName: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f59e0b",
  },
  statLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
    textTransform: "uppercase",
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
