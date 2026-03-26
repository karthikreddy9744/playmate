package com.playmate.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Service;

import com.playmate.entity.Game;
import com.playmate.entity.GameRequest;
import com.playmate.entity.Message;
import com.playmate.entity.Rating;
import com.playmate.entity.SportType;
import com.playmate.entity.User;
import com.playmate.exception.GameNotFoundException;
import com.playmate.exception.UserNotFoundException;
import com.playmate.repository.GameRepository;
import com.playmate.repository.GameRequestRepository;
import com.playmate.repository.MessageRepository;
import com.playmate.repository.RatingRepository;
import com.playmate.repository.UserRepository;

@Service
public class AdminService {

    @Autowired private UserRepository userRepository;
    @Autowired private GameRepository gameRepository;
    @Autowired private RatingRepository ratingRepository;
    @Autowired private GameRequestRepository gameRequestRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired(required = false) private RedisConnectionFactory redisConnectionFactory;

    // ── User Stats ─────────────────────────────────────────────────

    public Map<String, Long> getUserStats() {
        long totalUsers              = userRepository.count();
        long newUsersToday           = userRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(1));
        long activeUsersLast7Days    = userRepository.countByLastLoginAfter(LocalDateTime.now().minusDays(7));
        long activeUsersLast30Days   = userRepository.countByLastLoginAfter(LocalDateTime.now().minusDays(30));
        long verifiedUsers           = userRepository.countByVerifiedEmailTrue();

        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("totalUsers",           totalUsers);
        stats.put("newUsersToday",         newUsersToday);
        stats.put("activeUsersLast7Days",  activeUsersLast7Days);
        stats.put("activeUsersLast30Days", activeUsersLast30Days);
        stats.put("verifiedUsers",         verifiedUsers);
        return stats;
    }

    // ── Game Stats ─────────────────────────────────────────────────

    public Map<String, Object> getGameStats() {
        LocalDateTime now = LocalDateTime.now();
        List<Game> allGames = gameRepository.findAll();
        List<Game> nonCancelled = allGames.stream().filter(g -> !Boolean.TRUE.equals(g.getIsCancelled())).collect(Collectors.toList());

        long totalGames     = allGames.size();
        long cancelledGames = allGames.stream().filter(g -> Boolean.TRUE.equals(g.getIsCancelled())).count();
        long upcomingGames  = nonCancelled.stream().filter(g -> g.getGameDateTime() != null && g.getGameDateTime().isAfter(now)).count();
        long liveGames      = nonCancelled.stream().filter(g -> g.getGameDateTime() != null
                && !g.getGameDateTime().isAfter(now)
                && g.getGameDateTime().plusMinutes(g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60L).isAfter(now)).count();
        long completedGames = nonCancelled.stream().filter(g -> g.getGameDateTime() != null
                && g.getGameDateTime().plusMinutes(g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60L).isBefore(now)).count();
        long gamesToday     = allGames.stream().filter(g -> g.getGameDateTime() != null
                && g.getGameDateTime().toLocalDate().equals(LocalDate.now())).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalGames",     totalGames);
        stats.put("upcomingGames",  upcomingGames);
        stats.put("liveGames",      liveGames);
        stats.put("completedGames", completedGames);
        stats.put("cancelledGames", cancelledGames);
        stats.put("gamesToday",     gamesToday);
        return stats;
    }

    // ── Game Lifecycle Stats ────────────────────────────────────────

    public Map<String, Object> getGameLifecycle() {
        LocalDateTime now = LocalDateTime.now();
        List<Game> all = gameRepository.findAll();

        long total     = all.size();
        long cancelled = all.stream().filter(g -> Boolean.TRUE.equals(g.getIsCancelled())).count();
        long completed = all.stream().filter(g -> !Boolean.TRUE.equals(g.getIsCancelled())
                && g.getGameDateTime() != null
                && g.getGameDateTime().plusMinutes(g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60L).isBefore(now)).count();
        long live      = all.stream().filter(g -> !Boolean.TRUE.equals(g.getIsCancelled())
                && g.getGameDateTime() != null && !g.getGameDateTime().isAfter(now)
                && g.getGameDateTime().plusMinutes(g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60L).isAfter(now)).count();
        long upcoming  = all.stream().filter(g -> !Boolean.TRUE.equals(g.getIsCancelled())
                && g.getGameDateTime() != null && g.getGameDateTime().isAfter(now)).count();
        long full      = all.stream().filter(g -> !Boolean.TRUE.equals(g.getIsCancelled())
                && g.getMaxPlayers() != null && g.getCurrentPlayers() != null
                && g.getCurrentPlayers() >= g.getMaxPlayers()
                && g.getGameDateTime() != null && g.getGameDateTime().isAfter(now)).count();

        // Completion rate
        double completionRate = total > 0 ? (double)(completed) / total * 100 : 0;
        double cancellationRate = total > 0 ? (double)(cancelled) / total * 100 : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total",           total);
        result.put("upcoming",        upcoming);
        result.put("live",            live);
        result.put("completed",       completed);
        result.put("cancelled",       cancelled);
        result.put("full",            full);
        result.put("completionRate",  Math.round(completionRate * 10.0) / 10.0);
        result.put("cancellationRate",Math.round(cancellationRate * 10.0) / 10.0);

        // Funnel data for chart
        List<Map<String, Object>> funnel = List.of(
            Map.of("name", "Created",   "value", total),
            Map.of("name", "Upcoming",  "value", upcoming),
            Map.of("name", "Live",      "value", live),
            Map.of("name", "Completed", "value", completed),
            Map.of("name", "Cancelled", "value", cancelled)
        );
        result.put("funnel", funnel);
        return result;
    }

    // ── Area Analytics ─────────────────────────────────────────────

    public List<Map<String, Object>> getAreaAnalytics() {
        LocalDateTime now = LocalDateTime.now();
        List<Object[]> rows = gameRepository.findAreaStats();
        List<Object[]> playerRows = gameRepository.findPlayersByCity();
        Map<String, Long> playersByCity = playerRows.stream()
            .collect(Collectors.toMap(
                r -> r[0] != null ? r[0].toString() : "Unknown",
                r -> {
                    Object val = r[1];
                    return val instanceof Number ? ((Number) val).longValue() : 0L;
                },
                (a, b) -> a + b
            ));

        // Do completion computation in Java
        Map<String, Long> completedByCity = gameRepository.findAll().stream()
                .filter(g -> !Boolean.TRUE.equals(g.getIsCancelled())
                        && g.getGameDateTime() != null
                        && g.getGameDateTime().plusMinutes(g.getDurationMinutes() != null ? g.getDurationMinutes().longValue() : 60L).isBefore(now))
                .collect(Collectors.groupingBy(g -> g.getLocationCity() != null ? g.getLocationCity() : "Unknown", Collectors.counting()));

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            String city      = row[0] != null ? row[0].toString() : "Unknown";
            long   total     = row[1] != null ? ((Number) row[1]).longValue() : 0;
            long   cancelled  = row[2] != null ? ((Number) row[2]).longValue() : 0;
            long   completed  = completedByCity.getOrDefault(city, 0L);
            long   active     = total - cancelled - completed;
            long   players    = playersByCity.getOrDefault(city, 0L);

            Map<String, Object> cityData = new LinkedHashMap<>();
            cityData.put("city",      city);
            cityData.put("total",     total);
            cityData.put("active",    Math.max(0, active));
            cityData.put("completed", completed);
            cityData.put("cancelled", cancelled);
            cityData.put("players",   players);
            result.add(cityData);
        }
        return result;
    }

    // ── Feedback / Sentiment ────────────────────────────────────────

    public Map<String, Object> getFeedbackSentiment() {
        List<Rating> allRatings = ratingRepository.findAll();
        if (allRatings.isEmpty()) {
            return Map.of(
                "totalRatings",   0,
                "averageScore",   0.0,
                "positive",       0,
                "neutral",        0,
                "negative",       0,
                "positiveRate",   0.0,
                "distribution",   List.of(),
                "sportSentiment", List.of()
            );
        }

        long positive = 0, neutral = 0, negative = 0;
        Map<Integer, Long> distribution = new TreeMap<>();
        for (Rating r : allRatings) {
            double avg = (r.getPunctuality() + r.getSkillMatch() + r.getFriendliness()) / 3.0;
            int score = (int) Math.round(avg);
            distribution.merge(score, 1L, (a, b) -> a + b);
            if (avg >= 4.0) positive++;
            else if (avg >= 2.5) neutral++;
            else negative++;
        }

        double totalRatings  = allRatings.size();
        double averageScore  = allRatings.stream()
                .mapToDouble(r -> (r.getPunctuality() + r.getSkillMatch() + r.getFriendliness()) / 3.0)
                .average().orElse(0.0);

        List<Map<String, Object>> dist = distribution.entrySet().stream()
                .map(e -> Map.of("score", (Object) e.getKey(), "count", (Object) e.getValue()))
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRatings",  (long) totalRatings);
        result.put("averageScore",  Math.round(averageScore * 100.0) / 100.0);
        result.put("positive",      positive);
        result.put("neutral",       neutral);
        result.put("negative",      negative);
        result.put("positiveRate",  Math.round(positive / totalRatings * 100 * 10) / 10.0);
        result.put("distribution",  dist);
        return result;
    }

    // ── Game Creation Trend ─────────────────────────────────────────

    public List<Map<String, Object>> getGameCreationTrend(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<Game> recent = gameRepository.findRecentlyCreated(since);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM dd");

        // Group by date
        Map<LocalDate, Long> byDate = recent.stream()
                .filter(g -> g.getCreatedAt() != null)
                .collect(Collectors.groupingBy(g -> g.getCreatedAt().toLocalDate(), Collectors.counting()));

        // Fill all days in range
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusDays(i);
            trend.add(Map.of("date", d.format(fmt), "games", byDate.getOrDefault(d, 0L)));
        }
        return trend;
    }

    // ── User Retention ─────────────────────────────────────────────

    public Map<String, Object> getUserRetention() {
        long dau  = userRepository.countByLastLoginAfter(LocalDateTime.now().minusDays(1));
        long wau  = userRepository.countByLastLoginAfter(LocalDateTime.now().minusDays(7));
        long mau  = userRepository.countByLastLoginAfter(LocalDateTime.now().minusDays(30));
        long total = userRepository.count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dau",        dau);
        result.put("wau",        wau);
        result.put("mau",        mau);
        result.put("total",      total);
        result.put("dauRate",    total > 0 ? Math.round(dau * 10000.0 / total) / 100.0 : 0.0);
        result.put("wauRate",    total > 0 ? Math.round(wau * 10000.0 / total) / 100.0 : 0.0);
        result.put("mauRate",    total > 0 ? Math.round(mau * 10000.0 / total) / 100.0 : 0.0);

        // Growth rate (new users last 7 days vs prev 7)
        long newLast7  = userRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(7));
        long newPrev7  = userRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(14))
                       - newLast7;
        double growthRate = newPrev7 > 0 ? ((double)(newLast7 - newPrev7) / newPrev7) * 100 : 0;
        result.put("weeklyGrowthRate", Math.round(growthRate * 10) / 10.0);
        return result;
    }

    // ── Sport Distribution ─────────────────────────────────────────

    public List<Map<String, Object>> getSportDistribution() {
        List<Game> allGames = gameRepository.findAll();
        Map<String, Long> sportCounts = allGames.stream()
                .collect(Collectors.groupingBy(g -> g.getSportType() != null ? g.getSportType().toString() : "OTHER", Collectors.counting()));
        return sportCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> Map.of("name", (Object) e.getKey(), "value", (Object) e.getValue()))
                .collect(Collectors.toList());
    }

    // ── Sport Lifecycle ────────────────────────────────────────────

    public List<Map<String, Object>> getSportLifecycle() {
        List<Object[]> rows = gameRepository.findSportWiseLifecycle();
        return rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sport",     r[0] != null ? r[0].toString() : "OTHER");
            m.put("cancelled", r[1] != null ? ((Number) r[1]).longValue() : 0L);
            m.put("active",    r[2] != null ? ((Number) r[2]).longValue() : 0L);
            m.put("total",     r[3] != null ? ((Number) r[3]).longValue() : 0L);
            return m;
        }).collect(Collectors.toList());
    }

    // ── Revenue Data (computed from games: pricePerPlayer * participants) ────

    public List<Map<String, Object>> getRevenueData() {
        List<Game> allGames = gameRepository.findAll();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM yyyy");

        // Group revenue by month from actual game data
        Map<String, java.math.BigDecimal> revenueByMonth = new LinkedHashMap<>();
        allGames.stream()
                .filter(g -> g.getCreatedAt() != null && g.getPricePerPlayer() != null)
                .forEach(g -> {
                    String month = g.getCreatedAt().format(fmt);
                    Integer cp = g.getCurrentPlayers();
                    java.math.BigDecimal gameRevenue = g.getPricePerPlayer()
                            .multiply(java.math.BigDecimal.valueOf(cp != null ? cp : 0));
                    revenueByMonth.merge(month, gameRevenue, java.math.BigDecimal::add);
                });

        // If no revenue data exists, return last 6 months with zero
        if (revenueByMonth.isEmpty()) {
            List<Map<String, Object>> empty = new ArrayList<>();
            for (int i = 5; i >= 0; i--) {
                LocalDate d = LocalDate.now().minusMonths(i);
                empty.add(Map.of("month", d.format(fmt), "revenue", 0));
            }
            return empty;
        }

        return revenueByMonth.entrySet().stream()
                .map(e -> Map.of("month", (Object) e.getKey(), "revenue", (Object) e.getValue()))
                .collect(Collectors.toList());
    }

    // ── Recent Activity ────────────────────────────────────────────

    public List<Map<String, Object>> getRecentActivity() {
        List<Game> recent = gameRepository.findRecentlyCreated(LocalDateTime.now().minusDays(7));
        List<Map<String, Object>> activity = new ArrayList<>();
        int id = 1;
        for (Game g : recent.stream().limit(20).collect(Collectors.toList())) {
            // Resolve actual user name from createdBy ID
            String userName = "Unknown User";
            if (g.getCreatedBy() != null) {
                userName = userRepository.findById(g.getCreatedBy())
                        .map(User::getName)
                        .orElse("User #" + g.getCreatedBy());
            }
            activity.add(Map.of(
                "id",     (Object) id++,
                "user",   userName,
                "action", "created game",
                "sport",  g.getSportType() != null ? g.getSportType().toString() : "OTHER",
                "city",   g.getLocationCity() != null ? g.getLocationCity() : "Unknown",
                "time",   g.getCreatedAt() != null ? g.getCreatedAt().toString() : ""
            ));
        }
        return activity;
    }

    // ── Join Request Stats ─────────────────────────────────────────

    public Map<String, Object> getRequestStats() {
        List<GameRequest> all = gameRequestRepository.findAll();
        long total    = all.size();
        long accepted = all.stream().filter(r -> r.getStatus() == GameRequest.RequestStatus.ACCEPTED).count();
        long rejected = all.stream().filter(r -> r.getStatus() == GameRequest.RequestStatus.REJECTED).count();
        long pending  = all.stream().filter(r -> r.getStatus() == GameRequest.RequestStatus.PENDING).count();

        double acceptanceRate = total > 0 ? Math.round(accepted * 1000.0 / total) / 10.0 : 0;
        double rejectionRate  = total > 0 ? Math.round(rejected * 1000.0 / total) / 10.0 : 0;

        // Average response time (only resolved requests that have respondedAt)
        double avgResponseMinutes = all.stream()
            .filter(r -> r.getRespondedAt() != null && r.getCreatedAt() != null
                    && r.getStatus() != GameRequest.RequestStatus.PENDING)
            .mapToLong(r -> Duration.between(r.getCreatedAt(), r.getRespondedAt()).toMinutes())
            .average().orElse(0);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRequests",      total);
        result.put("accepted",           accepted);
        result.put("rejected",           rejected);
        result.put("pending",            pending);
        result.put("acceptanceRate",     acceptanceRate);
        result.put("rejectionRate",      rejectionRate);
        result.put("avgResponseMinutes", Math.round(avgResponseMinutes * 10.0) / 10.0);
        return result;
    }

    // ── Messaging Stats ────────────────────────────────────────────

    public Map<String, Object> getMessagingStats() {
        List<Message> all = messageRepository.findAll();
        long totalMessages = all.size();

        // Unique conversations (unordered pair of sender+receiver where gameId is null = DM)
        long dmConversations = all.stream()
            .filter(m -> m.getGameId() == null)
            .map(m -> {
                long a = m.getSender().getId(), b = m.getReceiver().getId();
                return Math.min(a, b) + "-" + Math.max(a, b);
            })
            .distinct().count();

        // Group chats = distinct non-null gameIds
        long groupChats = all.stream()
            .filter(m -> m.getGameId() != null)
            .map(Message::getGameId)
            .distinct().count();

        long unreadMessages = all.stream().filter(m -> !Boolean.TRUE.equals(m.getIsRead())).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMessages",   totalMessages);
        result.put("dmConversations", dmConversations);
        result.put("groupChats",      groupChats);
        result.put("unreadMessages",  unreadMessages);
        return result;
    }

    // ── Host Leaderboard ───────────────────────────────────────────

    public List<Map<String, Object>> getHostLeaderboard() {
        List<Game> allGames = gameRepository.findAll();
        // Group by createdBy
        Map<Long, List<Game>> byHost = allGames.stream()
            .filter(g -> g.getCreatedBy() != null)
            .collect(Collectors.groupingBy(Game::getCreatedBy));

        List<Map<String, Object>> leaderboard = new ArrayList<>();
        for (Map.Entry<Long, List<Game>> entry : byHost.entrySet()) {
            Long hostId = entry.getKey();
            List<Game> games = entry.getValue();
            Optional<User> userOpt = userRepository.findById(hostId);
            String name = userOpt.map(User::getName).orElse("User #" + hostId);
            double avgRating = userOpt.map(u -> u.getAverageRating() != null ? u.getAverageRating().doubleValue() : 0.0).orElse(0.0);
            double reliability = userOpt.map(u -> u.getHostReliabilityScore() != null ? u.getHostReliabilityScore().doubleValue() : 100.0).orElse(100.0);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId",          hostId);
            row.put("name",            name);
            row.put("gamesHosted",     games.size());
            row.put("hostReliability", Math.round(reliability));
            row.put("avgRating",       Math.round(avgRating * 100.0) / 100.0);
            leaderboard.add(row);
        }
        leaderboard.sort(Comparator.comparingInt((Map<String, Object> m) -> ((Number) m.get("gamesHosted")).intValue()).reversed());
        return leaderboard.stream().limit(10).collect(Collectors.toList());
    }

    // ── Player Leaderboard ─────────────────────────────────────────

    public List<Map<String, Object>> getPlayerLeaderboard() {
        List<User> users = userRepository.findAll();
        return users.stream()
            .filter(u -> u.getTotalGamesPlayed() != null && u.getTotalGamesPlayed() > 0)
            .sorted(Comparator.comparingInt(User::getTotalGamesPlayed).reversed())
            .limit(10)
            .map(u -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId",               u.getId());
                row.put("name",                 u.getName());
                row.put("gamesPlayed",          u.getTotalGamesPlayed());
                row.put("playAgainPercentage",  u.getPlayAgainPercentage() != null ? u.getPlayAgainPercentage().doubleValue() : 0.0);
                row.put("avgRating",            u.getAverageRating() != null ? u.getAverageRating().doubleValue() : 0.0);
                row.put("city",                 u.getLocationCity() != null ? u.getLocationCity() : "Unknown");
                return row;
            })
            .collect(Collectors.toList());
    }

    // ── Cancellations ──────────────────────────────────────────────

    public List<Map<String, Object>> getCancellations() {
        return userRepository.findAll().stream()
                .filter(u -> u.getGamesCancelled() != null && u.getGamesCancelled() > 0)
                .sorted((u1, u2) -> u2.getGamesCancelled().compareTo(u1.getGamesCancelled()))
                .limit(10)
                .map(u -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("userId",      u.getId());
                    row.put("name",        u.getName());
                    row.put("cancelled",   u.getGamesCancelled());
                    row.put("lastMinute",  Objects.requireNonNullElse(u.getLastMinuteCancellations(), 0));
                    row.put("reliability", u.getHostReliabilityScore() != null ? u.getHostReliabilityScore().intValue() : 100);
                    return row;
                })
                .collect(Collectors.toList());
    }

    // ── No-Show Tracking ───────────────────────────────────────────

    public List<Map<String, Object>> getNoShowTracking() {
        List<User> users = userRepository.findAll();
        return users.stream()
            .filter(u -> u.getNoShowCount() != null && u.getNoShowCount() > 0)
            .sorted(Comparator.comparingInt(User::getNoShowCount).reversed())
            .limit(15)
            .map(u -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId",      u.getId());
                row.put("name",        u.getName());
                row.put("noShows",     u.getNoShowCount());
                Integer totalGamesRaw = u.getTotalGamesPlayed();
                int gamesPlayed = totalGamesRaw != null ? totalGamesRaw : 0;
                row.put("gamesPlayed", gamesPlayed);
                double rate = gamesPlayed > 0
                    ? Math.round(u.getNoShowCount() * 1000.0 / gamesPlayed) / 10.0 : 0;
                row.put("noShowRate",  rate);
                return row;
            })
            .collect(Collectors.toList());
    }

    // ── Verification Stats ─────────────────────────────────────────

    public Map<String, Object> getVerificationStats() {
        long total        = userRepository.count();
        long emailVerified = userRepository.countByVerifiedEmailTrue();
        long emailUnverified = total - emailVerified;

        List<User> allUsers = userRepository.findAll();
        long idVerified   = allUsers.stream().filter(u -> Boolean.TRUE.equals(u.getVerifiedId())).count();
        long idUnverified = total - idVerified;
        long fullyVerified = allUsers.stream()
            .filter(u -> Boolean.TRUE.equals(u.getVerifiedEmail()) && Boolean.TRUE.equals(u.getVerifiedId())).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalUsers",       total);
        result.put("emailVerified",    emailVerified);
        result.put("emailUnverified",  emailUnverified);
        result.put("idVerified",       idVerified);
        result.put("idUnverified",     idUnverified);
        result.put("fullyVerified",    fullyVerified);
        result.put("emailVerifiedRate", total > 0 ? Math.round(emailVerified * 1000.0 / total) / 10.0 : 0);
        result.put("idVerifiedRate",   total > 0 ? Math.round(idVerified * 1000.0 / total) / 10.0 : 0);
        return result;
    }

    // ── Peak Hours Heatmap ─────────────────────────────────────────

    public List<Map<String, Object>> getPeakHours() {
        List<Game> allGames = gameRepository.findAll();
        // Build 7 x 24 grid: dayOfWeek x hour
        int[][] grid = new int[7][24];
        for (Game g : allGames) {
            LocalDateTime dt = g.getGameDateTime();
            if (dt != null) {
                int dow  = dt.getDayOfWeek().getValue() - 1; // 0=Mon
                int hour = dt.getHour();
                if (dow >= 0 && dow < 7 && hour >= 0 && hour < 24) {
                    grid[dow][hour]++;
                }
            }
        }
        String[] dayNames = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
        List<Map<String, Object>> result = new ArrayList<>();
        for (int d = 0; d < 7; d++) {
            for (int h = 0; h < 24; h++) {
                Map<String, Object> cell = new LinkedHashMap<>();
                cell.put("day",   dayNames[d]);
                cell.put("hour",  h);
                cell.put("count", grid[d][h]);
                result.add(cell);
            }
        }
        return result;
    }

    // ── Average Game Fill Rate ─────────────────────────────────────

    public Map<String, Object> getAvgFillRate() {
        List<Game> allGames = gameRepository.findAll();
        List<Game> withSlots = allGames.stream()
            .filter(g -> g.getMaxPlayers() != null && g.getMaxPlayers() > 0 && g.getCurrentPlayers() != null)
            .collect(Collectors.toList());

        double avgFillRate = withSlots.stream()
            .mapToDouble(g -> (double) g.getCurrentPlayers() / g.getMaxPlayers() * 100)
            .average().orElse(0);

        long fullyFilled = withSlots.stream().filter(g -> g.getCurrentPlayers() >= g.getMaxPlayers()).count();
        long halfFilled  = withSlots.stream().filter(g -> {
            double ratio = (double) g.getCurrentPlayers() / g.getMaxPlayers();
            return ratio >= 0.5 && ratio < 1.0;
        }).count();
        long lowFill = withSlots.stream().filter(g -> {
            double ratio = (double) g.getCurrentPlayers() / g.getMaxPlayers();
            return ratio < 0.5;
        }).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("avgFillRate",    Math.round(avgFillRate * 10.0) / 10.0);
        result.put("totalGames",     withSlots.size());
        result.put("fullyFilled",    fullyFilled);
        result.put("halfFilled",     halfFilled);
        result.put("lowFill",        lowFill);
        return result;
    }

    // ── Ghosting & Conducted Stats ─────────────────────────────────

    public Map<String, Object> getGhostingStats() {
        List<Rating> hostRatings = ratingRepository.findAll().stream()
                .filter(r -> r.getRatingType() == Rating.RatingType.FOR_HOST && r.getWasGameConducted() != null)
                .collect(Collectors.toList());

        long totalReports = hostRatings.size();
        long conductedCount = hostRatings.stream().filter(r -> Boolean.TRUE.equals(r.getWasGameConducted())).count();
        long ghostedCount = hostRatings.stream().filter(r -> Boolean.FALSE.equals(r.getWasGameConducted())).count();

        double trustRate = totalReports > 0 ? (double) conductedCount / totalReports * 100 : 100.0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalReports",   totalReports);
        result.put("conductedCount", conductedCount);
        result.put("ghostedCount",   ghostedCount);
        result.put("trustRate",      Math.round(trustRate * 10.0) / 10.0);
        return result;
    }

    // ── System Health ──────────────────────────────────────────────

    public Map<String, Object> getSystemHealth() {
        Map<String, Object> result = new LinkedHashMap<>();

        // DB check
        try {
            long userCount = userRepository.count();
            result.put("dbStatus", "UP");
            result.put("dbUserCount", userCount);
        } catch (Exception e) {
            result.put("dbStatus", "DOWN");
            result.put("dbError", e.getMessage());
        }

        // Redis check
        try {
            if (redisConnectionFactory != null) {
                redisConnectionFactory.getConnection().ping();
                result.put("redisStatus", "UP");
            } else {
                result.put("redisStatus", "NOT_CONFIGURED");
            }
        } catch (Exception e) {
            result.put("redisStatus", "DOWN");
            result.put("redisError", e.getMessage());
        }

        // JVM stats
        Runtime rt = Runtime.getRuntime();
        result.put("jvmTotalMemoryMB",  rt.totalMemory() / (1024 * 1024));
        result.put("jvmFreeMemoryMB",   rt.freeMemory()  / (1024 * 1024));
        result.put("jvmUsedMemoryMB",   (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024));
        result.put("jvmMaxMemoryMB",    rt.maxMemory()    / (1024 * 1024));
        result.put("availableProcessors", rt.availableProcessors());

        // Counts
        result.put("totalUsers",    userRepository.count());
        result.put("totalGames",    gameRepository.count());
        result.put("totalMessages", messageRepository.count());
        result.put("totalRatings",  ratingRepository.count());
        result.put("totalRequests", gameRequestRepository.count());

        return result;
    }

    // ── User Management ────────────────────────────────────────────

    public List<User> getAllUsers() { return userRepository.findAll(); }

    public Optional<User> getUserById(Long id) { return userRepository.findById(id); }

    public User updateUser(Long id, User details) {
        User user = userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("User not found: " + id));
        if (details.getEmail()    != null) user.setEmail(details.getEmail());
        if (details.getName()     != null) user.setName(details.getName());

        if (details.getRole()     != null) user.setRole(details.getRole());
        if (details.getIsActive() != null) user.setIsActive(details.getIsActive());
        return userRepository.save(user);
    }

    public User patchUser(Long id, Map<String, Object> updates) {
        User user = userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("User not found: " + id));
        if (updates.containsKey("email") && updates.get("email") != null) user.setEmail(updates.get("email").toString());
        if (updates.containsKey("name") && updates.get("name") != null) user.setName(updates.get("name").toString());
        if (updates.containsKey("role") && updates.get("role") != null) user.setRole(updates.get("role").toString());
        if (updates.containsKey("isActive") && updates.get("isActive") != null) {
            Object v = updates.get("isActive");
            user.setIsActive(v instanceof Boolean ? (Boolean) v : Boolean.valueOf(String.valueOf(v)));
        }
        if (updates.containsKey("phone") && updates.get("phone") != null) user.setPhone(updates.get("phone").toString());
        if (updates.containsKey("locationCity") && updates.get("locationCity") != null) user.setLocationCity(updates.get("locationCity").toString());
        return userRepository.save(user);
    }

    public void deleteUser(Long id) { userRepository.deleteById(id); }

    // ── Game Management ────────────────────────────────────────────

    public List<Game> getAllGames() { return gameRepository.findAll(); }

    public Optional<Game> getGameById(Long id) { return gameRepository.findById(id); }

    public Game updateGame(Long id, Game details) {
        Game game = gameRepository.findById(id).orElseThrow(() -> new GameNotFoundException("Game not found: " + id));
        if (details.getSportType()      != null) game.setSportType(details.getSportType());
        if (details.getGameDateTime()   != null) game.setGameDateTime(details.getGameDateTime());
        if (details.getLocationAddress() != null) game.setLocationAddress(details.getLocationAddress());
        if (details.getIsCancelled()    != null) game.setIsCancelled(details.getIsCancelled());
        return gameRepository.save(game);
    }

    public Game patchGame(Long id, Map<String, Object> updates) {
        Game game = gameRepository.findById(id).orElseThrow(() -> new GameNotFoundException("Game not found: " + id));
        if (updates.containsKey("sportType") && updates.get("sportType") != null) {
            try {
                String s = updates.get("sportType").toString().toUpperCase();
                game.setSportType(SportType.valueOf(s));
            } catch (Exception ex) { /* ignore invalid sport type */ }
        }
        if (updates.containsKey("locationAddress") && updates.get("locationAddress") != null) game.setLocationAddress(updates.get("locationAddress").toString());
        if (updates.containsKey("locationName") && updates.get("locationName") != null) {
            // map frontend 'locationName' to backend 'locationAddress' if present
            game.setLocationAddress(updates.get("locationName").toString());
        }
        if (updates.containsKey("isCancelled") && updates.get("isCancelled") != null) {
            Object v = updates.get("isCancelled");
            game.setIsCancelled(v instanceof Boolean ? (Boolean) v : Boolean.valueOf(String.valueOf(v)));
        }
        if (updates.containsKey("durationMinutes") && updates.get("durationMinutes") != null) {
            try {
                game.setDurationMinutes(Integer.valueOf(updates.get("durationMinutes").toString()));
            } catch (NumberFormatException e) { /* ignore invalid */ }
        }
        if (updates.containsKey("maxPlayers") && updates.get("maxPlayers") != null) {
            try {
                game.setMaxPlayers(Integer.valueOf(updates.get("maxPlayers").toString()));
            } catch (NumberFormatException e) { /* ignore invalid */ }
        }
        if (updates.containsKey("gameDateTime") && updates.get("gameDateTime") != null) {
            try {
                game.setGameDateTime(LocalDateTime.parse(updates.get("gameDateTime").toString()));
            } catch (Exception e) { /* ignore parse errors */ }
        }
        return gameRepository.save(game);
    }

    public void deleteGame(Long id) { gameRepository.deleteById(id); }
}
