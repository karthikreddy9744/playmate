package com.playmate.dto;

import lombok.Data;

@Data
public class UserUpdateRequest {
    private String name;
    private String email;

    private Integer age;
    private String gender;
    private String bio;
    private String profilePictureUrl;
    private String locationCity;
    private String phone;
    private String role;
}
