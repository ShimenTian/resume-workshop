package com.resumeworkshop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiErrorHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiErrorHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> invalid(ApiException error) { return error(error.status(), error.getMessage()); }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> invalidJson() { return error(HttpStatus.BAD_REQUEST, "请求内容需要是有效的简历 JSON。"); }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, String>> storage(DataAccessException exception) {
        LOG.error("Resume storage failed", exception);
        return error(HttpStatus.SERVICE_UNAVAILABLE, "简历存储暂时不可用，请稍后重试。");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) { return ResponseEntity.status(status).body(Map.of("error", message)); }
}
