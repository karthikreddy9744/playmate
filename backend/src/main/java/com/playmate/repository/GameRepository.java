package com.playmate.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.playmate.entity.Game;
import com.playmate.entity.SportType;

public interface GameRepository extends JpaRepository<Game, Long> {

  List<Game> findBySportType(SportType sportType);

  @Query("select g from Game g where g.gameDateTime between :from and :to")
  List<Game> findUpcomingBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

  long countByGameDateTimeAfter(LocalDateTime dateTime);
  long countByGameDateTimeBetween(LocalDateTime startDateTime, LocalDateTime endDateTime);

  /** Non-cancelled games that haven't ended yet (max duration 4h window from service start) */
  List<Game> findByIsCancelledFalseAndGameDateTimeAfterOrderByGameDateTimeAsc(LocalDateTime windowStart);

  /** All non-cancelled games (used for lifecycle computation) */
  List<Game> findByIsCancelledFalse();

  /** All cancelled games count */
  long countByIsCancelledTrue();

  /** Area stats: city, total, cancelled count */
  @Query("select g.locationCity, count(g), " +
         "sum(case when g.isCancelled = true then 1 else 0 end) " +
         "from Game g group by g.locationCity order by count(g) desc")
  List<Object[]> findAreaStats();

  /** Sport-wise lifecycle breakdown */
  @Query("select g.sportType, " +
         "sum(case when g.isCancelled = true then 1 else 0 end), " +
         "sum(case when g.isCancelled = false then 1 else 0 end), count(g) " +
         "from Game g group by g.sportType")
  List<Object[]> findSportWiseLifecycle();

  /** Recently created games for trend analysis */
  @Query("select g from Game g where g.createdAt >= :since order by g.createdAt asc")
  List<Game> findRecentlyCreated(@Param("since") LocalDateTime since);

  /** Players by city for density map */
  @Query("select g.locationCity, count(distinct p.id) from Game g " +
         "join g.participants p group by g.locationCity")
  List<Object[]> findPlayersByCity();
}
