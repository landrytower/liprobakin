import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>FEBACO</Text>
          <Text style={styles.heroSubtitle}>
            Federation of Basketball of Congo
          </Text>
          <Text style={styles.heroDescription}>
            Official app for Congolese basketball leagues
          </Text>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
          <View style={styles.quickLinksGrid}>
            <Link href="/(tabs)/teams" asChild>
              <TouchableOpacity style={styles.quickLinkCard}>
                <Text style={styles.quickLinkIcon}>🏀</Text>
                <Text style={styles.quickLinkText}>Teams</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/(tabs)/schedule" asChild>
              <TouchableOpacity style={styles.quickLinkCard}>
                <Text style={styles.quickLinkIcon}>📅</Text>
                <Text style={styles.quickLinkText}>Schedule</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/(tabs)/standings" asChild>
              <TouchableOpacity style={styles.quickLinkCard}>
                <Text style={styles.quickLinkIcon}>🏆</Text>
                <Text style={styles.quickLinkText}>Standings</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/(tabs)/account" asChild>
              <TouchableOpacity style={styles.quickLinkCard}>
                <Text style={styles.quickLinkIcon}>👤</Text>
                <Text style={styles.quickLinkText}>Account</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Recent Games Section - Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Games</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Connect to see recent games
            </Text>
          </View>
        </View>

        {/* News Section - Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest News</Text>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              Connect to see latest news
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
  hero: {
    backgroundColor: "#1a1a2e",
    padding: 30,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d44",
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#f59e0b",
    letterSpacing: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#fff",
    marginTop: 8,
    textAlign: "center",
  },
  heroDescription: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  quickLinksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  quickLinkCard: {
    width: "48%",
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  quickLinkIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickLinkText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  placeholderCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d2d44",
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
