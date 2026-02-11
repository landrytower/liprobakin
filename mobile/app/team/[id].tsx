import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Team Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🏀</Text>
          </View>
          <Text style={styles.teamName}>Team Name</Text>
          <Text style={styles.teamRecord}>Record: 0-0</Text>
        </View>

        {/* Roster Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roster</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Team ID: {id}
            </Text>
            <Text style={styles.placeholderText}>
              Connect to Firebase to load roster
            </Text>
          </View>
        </View>

        {/* Schedule Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Games</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Connect to Firebase to load schedule
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
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2d2d44",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 48,
  },
  teamName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  teamRecord: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 8,
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
