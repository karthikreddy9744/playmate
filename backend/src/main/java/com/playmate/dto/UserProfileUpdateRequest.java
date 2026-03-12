package com.playmate.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileUpdateRequest {
    private String name;
    private Integer age;
    private String gender;
    private String bio;
    private String phone;
    private String locationCity;
    private String locationAddress;
    private Double locationLat;
    private Double locationLng;
    private String profilePictureUrl;
    private List<SportItem> sports;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SportItem {
        private String sportType;
        private String skillLevel;
    }
}
