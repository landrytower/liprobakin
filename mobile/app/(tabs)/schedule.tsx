import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScheduleScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateFilter}
          contentContainerStyle={styles.dateFilterContent}
        >
          {["Today", "Tomorrow", "This Week", "All Games"].map((label, index) => (
            <TouchableOpacity
              key={label}
              style={[styles.dateButton, index === 0 && styles.dateButtonActive]}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  index === 0 && styles.dateButtonTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Games List */}
        <View style={styles.section}>
          <Text style={styles.dateHeader}>Upcoming Games</Text>

          {/* Placeholder games */}
          {[1, 2, 3].map((_, index) => (
            <TouchableOpacity key={index} style={styles.gameCard}>
              <View style={styles.gameTime}>
                <Text style={styles.gameDate}>Feb {10 + index}</Text>
                <Text style={styles.gameHour}>7:00 PM</Text>
              </View>
              <View style={styles.gameTeams}>
                <View style={styles.teamRow}>
                  <Text style={styles.teamEmoji}>🏀</Text>
                  <Text style={styles.teamName}>Team A</Text>
                  <Text style={styles.teamScore}>-</Text>
                </View>
                <View style={styles.teamRow}>
                  <Text style={styles.teamEmoji}>🏀</Text>
                  <Text style={styles.teamName}>Team B</Text>
                  <Text style={styles.teamScore}>-</Text>
                </View>
              </View>
              <View style={styles.gameStatus}>
                <Text style={styles.statusText}>Scheduled</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Connect to Firebase to see live schedule
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
  dateFilter: {
    backgroundColor: "#1a1a2e",
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d44",
  },
  dateFilterContent: {
    padding: 16,
    gap: 8,
  },
  dateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#2d2d44",
    marginRight: 8,
  },
  dateButtonActive: {
    backgroundColor: "#f59e0b",
  },
  dateButtonText: {
    color: "#9ca3af",
    fontWeight: "500",
  },
  dateButtonTextActive: {
    color: "#000",
  },
  section: {
    padding: 16,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  gameCard: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2d2d44",
    alignItems: "center",
  },
  gameTime: {
    width: 60,
    alignItems: "center",
  },
  gameDate: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
  },
  gameHour: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  gameTeams: {
    flex: 1,
    marginLeft: 16,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  teamEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  teamName: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  teamScore: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
    width: 30,
    textAlign: "right",
  },
  gameStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#2d2d44",
  },
  statusText: {
    fontSize: 10,
    color: "#9ca3af",
    textTransform: "uppercase",
  },
  placeholderCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
    marginTop: 8,
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
});
