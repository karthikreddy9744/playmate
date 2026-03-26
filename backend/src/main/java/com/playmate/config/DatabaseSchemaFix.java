package com.playmate.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.dao.DataAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class DatabaseSchemaFix implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaFix.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        log.info("Checking for database schema fixes...");
        
        // 1. Drop old duration constraint
        try {
            // Find all check constraints on duration_minutes and drop them
            String findConstraintsSql = "SELECT constraint_name FROM information_schema.constraint_column_usage " +
                                      "WHERE table_name = 'games' AND column_name = 'duration_minutes'";
            java.util.List<String> constraints = jdbcTemplate.queryForList(findConstraintsSql, String.class);
            
            for (String constraint : constraints) {
                if (constraint.contains("check")) {
                    log.info("Dropping constraint: {}", constraint);
                    jdbcTemplate.execute("ALTER TABLE games DROP CONSTRAINT IF EXISTS " + constraint);
                }
            }
            
            // Also try the standard name just in case
            jdbcTemplate.execute("ALTER TABLE games DROP CONSTRAINT IF EXISTS games_duration_minutes_check");
            log.info("Successfully processed duration constraints.");
        } catch (DataAccessException e) {
            log.warn("Error while dropping duration constraints: {}", e.getMessage());
        }

        // 2. Fix NULL status values
        try {
            // Check if column exists, if not add it
            try {
                jdbcTemplate.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS status VARCHAR(20)");
                log.info("Successfully ensured 'status' column exists.");
            } catch (Exception e) {
                log.warn("Could not add 'status' column (might already exist): {}", e.getMessage());
            }

            jdbcTemplate.execute("UPDATE games SET status = 'OPEN' WHERE status IS NULL");
            log.info("Successfully updated NULL status values to 'OPEN'.");
            
            // Now make it NOT NULL
            try {
                jdbcTemplate.execute("ALTER TABLE games ALTER COLUMN status SET NOT NULL");
                log.info("Successfully set 'status' column to NOT NULL.");
            } catch (Exception e) {
                log.warn("Could not set 'status' column to NOT NULL: {}", e.getMessage());
            }
        } catch (DataAccessException e) {
            log.warn("Error during 'status' column fix: {}", e.getMessage());
        }
    }
}
