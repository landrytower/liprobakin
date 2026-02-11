import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTeams } from "../../hooks/useFirestore";

type LeagueFilter = "men" | "women";

export default function TeamsScreen() {
  const [selectedLeague, setSelectedLeague] = useState<LeagueFilter>("men");
  const { teams, loading, error } = useTeams(selectedLeague);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* League Selector */}
        <View style={styles.leagueSelector}>
          <TouchableOpacity
            style={[
              styles.leagueButton,
              selectedLeague === "men" && styles.leagueButtonActive,
            ]}
            onPress={() => setSelectedLeague("men")}
          >
            <Text
              style={[
                styles.leagueButtonText,
                selectedLeague === "men" && styles.leagueButtonTextActive,
              ]}
            >
              Men's League
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.leagueButton,
              selectedLeague === "women" && styles.leagueButtonActive,
            ]}
            onPress={() => setSelectedLeague("women")}
          >
            <Text
              style={[
                styles.leagueButtonText,
                selectedLeague === "women" && styles.leagueButtonTextActive,
              ]}
            >
              Women's League
            </Text>
          </TouchableOpacity>
        </View>

        {/* Teams List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teams</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Loading teams...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : teams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No teams found</Text>
            </View>
          ) : (
            teams.map((team) => (
              <Link href={`/team/${team.id}`} asChild key={team.id}>
                <TouchableOpacity style={styles.teamCard}>
                  <View style={styles.teamLogo}>
                    {team.logo ? (
                      <Image
                        source={{ uri: team.logo }}
                        style={styles.teamLogoImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.teamLogoText}>🏀</Text>
                    )}
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamRecord}>
                      {team.wins}-{team.losses}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              </Link>
            ))
          )}
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
  leagueSelector: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  leagueButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  leagueButtonActive: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  leagueButtonText: {
    color: "#9ca3af",
    fontWeight: "600",
  },
  leagueButtonTextActive: {
    color: "#000",
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#9ca3af",
    marginTop: 12,
  },
  errorContainer: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
  },
  emptyContainer: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  emptyText: {
    color: "#6b7280",
  },
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2d2d44",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  teamLogoImage: {
    width: 40,
    height: 40,
  },
  teamLogoText: {
    fontSize: 24,
  },
  teamInfo: {
    flex: 1,
    marginLeft: 16,
  },
  teamName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  teamRecord: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: "#6b7280",
  },
});
