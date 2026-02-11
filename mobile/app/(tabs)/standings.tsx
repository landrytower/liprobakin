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
import { SafeAreaView } from "react-native-safe-area-context";
import { useStandings } from "../../hooks/useFirestore";

type LeagueFilter = "men" | "women";

export default function StandingsScreen() {
  const [selectedLeague, setSelectedLeague] = useState<LeagueFilter>("men");
  const { standings, loading, error } = useStandings(selectedLeague);

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

        {/* Standings Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Standings</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Loading standings...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : standings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No standings available</Text>
            </View>
          ) : (
            <>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.rankCell]}>#</Text>
                <Text style={[styles.headerCell, styles.teamCell]}>Team</Text>
                <Text style={[styles.headerCell, styles.statCell]}>W</Text>
                <Text style={[styles.headerCell, styles.statCell]}>L</Text>
                <Text style={[styles.headerCell, styles.statCell]}>PCT</Text>
              </View>

              {/* Standings Rows */}
              {standings.map((standing, index) => (
                <View
                  key={standing.teamId}
                  style={[
                    styles.tableRow,
                    index === standings.length - 1 && styles.tableRowLast,
                  ]}
                >
                  <Text style={[styles.cell, styles.rankCell]}>{standing.rank}</Text>
                  <View style={[styles.teamCell, styles.teamCellContent]}>
                    {standing.teamLogo ? (
                      <Image
                        source={{ uri: standing.teamLogo }}
                        style={styles.teamLogo}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.teamEmoji}>🏀</Text>
                    )}
                    <Text style={styles.teamName} numberOfLines={1}>
                      {standing.teamName}
                    </Text>
                  </View>
                  <Text style={[styles.cell, styles.statCell]}>{standing.wins}</Text>
                  <Text style={[styles.cell, styles.statCell]}>{standing.losses}</Text>
                  <Text style={[styles.cell, styles.statCell]}>
                    {standing.winPercentage.toFixed(3).slice(1)}
                  </Text>
                </View>
              ))}
            </>
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
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  headerCell: {
    color: "#9ca3af",
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#2d2d44",
  },
  cell: {
    color: "#fff",
    fontSize: 14,
  },
  rankCell: {
    width: 30,
    textAlign: "center",
  },
  teamCell: {
    flex: 1,
  },
  teamCellContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  teamLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  teamEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  teamName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  statCell: {
    width: 45,
    textAlign: "center",
  },
  tableRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
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
});
