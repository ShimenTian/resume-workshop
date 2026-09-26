package com.resumeworkshop;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
@ConditionalOnProperty(prefix = "resume.storage", name = "api-enabled", havingValue = "true")
public class RequestLimitFilter extends OncePerRequestFilter {
    static final int MAX_BYTES = 1_048_576;
    static final int MAX_CHARACTERS = 256_000;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/api/") || !(request.getMethod().equals("PUT") || request.getMethod().equals("POST"))) {
            chain.doFilter(request, response);
            return;
        }
        byte[] bytes = request.getInputStream().readNBytes(MAX_BYTES + 1);
        if (bytes.length > MAX_BYTES || new String(bytes, StandardCharsets.UTF_8).length() > MAX_CHARACTERS) {
            response.setStatus(413);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"请求内容过大，请缩减简历内容。\"}");
            return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override
            public ServletInputStream getInputStream() {
                ByteArrayInputStream source = new ByteArrayInputStream(bytes);
                return new ServletInputStream() {
                    @Override public int read() { return source.read(); }
                    @Override public int read(byte[] buffer, int offset, int length) { return source.read(buffer, offset, length); }
                    @Override public boolean isFinished() { return source.available() == 0; }
                    @Override public boolean isReady() { return true; }
                    @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException("Synchronous requests only"); }
                };
            }
        }, response);
    }
}
