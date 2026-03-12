package com.playmate.service;

import java.io.IOException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

@Service
public class CloudinaryService {
    
    private final Cloudinary cloudinary;
    
    public CloudinaryService(
            @Value("${cloudinary.cloud.name}") String cloudName,
            @Value("${cloudinary.api.key}") String apiKey,
            @Value("${cloudinary.api.secret}") String apiSecret) {
        
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
            "cloud_name", cloudName,
            "api_key", apiKey,
            "api_secret", apiSecret,
            "secure", true
        ));
    }
    
    @SuppressWarnings("unchecked")
    public String uploadImage(MultipartFile file, String folder) throws IOException {
        com.cloudinary.Transformation<?> transformation = new com.cloudinary.Transformation<>()
            .width(800).height(600).crop("limit").quality("auto").fetchFormat("auto");

        Map<String, Object> uploadResult = cloudinary.uploader().upload(
            file.getBytes(),
            ObjectUtils.asMap(
                "folder", "playmate/" + folder,
                "transformation", transformation
            )
        );
        
        return (String) uploadResult.get("secure_url");
    }
    
    public String uploadProfilePicture(MultipartFile file, Long userId) throws IOException {
        return uploadImage(file, "profiles/" + userId);
    }
    
    public String uploadGameImage(MultipartFile file, Long gameId) throws IOException {
        return uploadImage(file, "games/" + gameId);
    }
    
    public String uploadVenueImage(MultipartFile file, Long venueId) throws IOException {
        return uploadImage(file, "venues/" + venueId);
    }
    
    @SuppressWarnings("unchecked")
    public boolean deleteImage(String publicId) throws IOException {
        Map<String, Object> result = cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
        return "ok".equals(result.get("result"));
    }
    
    @SuppressWarnings("rawtypes")
    public String generateImageUrl(String publicId, int width, int height) {
        return cloudinary.url()
            .format("auto")
            .transformation(new com.cloudinary.Transformation()
                .width(width)
                .height(height)
                .crop("fill")
                .quality("auto"))
            .generate(publicId);
    }
    
    @SuppressWarnings("unchecked")
    public Map<String, Object> getImageInfo(String publicId) throws Exception {
        return cloudinary.api().resource(publicId, ObjectUtils.emptyMap());
    }
}