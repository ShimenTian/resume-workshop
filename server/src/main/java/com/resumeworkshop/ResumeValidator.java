package com.resumeworkshop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class ResumeValidator {
    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_-]{1,80}$");
    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$");
    private static final DateTimeFormatter MILLISECONDS = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();

    public String id(String value) {
        if (value == null || !ID.matcher(value).matches()) fail("简历标识格式无效。");
        return value;
    }

    public ObjectNode validate(JsonNode value, String pathId) {
        ObjectNode doc = object(value, "简历", "id", "title", "updatedAt", "templateId", "accent", "profile", "experiences", "education", "projects", "skills");
        String docId = id(string(doc, "id", 80));
        if (!id(pathId).equals(docId)) fail("路径中的简历标识与内容不一致。");
        string(doc, "title", 100);
        String timestamp = string(doc, "updatedAt", 40);
        try {
            if (!DATE.matcher(timestamp).matches() || !MILLISECONDS.format(Instant.parse(timestamp)).equals(timestamp)) {
                fail("更新时间需要是有效的 ISO 日期。");
            }
        } catch (DateTimeParseException e) { fail("更新时间需要是有效的 ISO 日期。"); }
        if (!Set.of("classic", "sidebar", "modern").contains(string(doc, "templateId", 20))) fail("简历模板无效。");
        if (!string(doc, "accent", 7).matches("^#[0-9a-fA-F]{6}$")) fail("主题颜色需要是六位十六进制颜色。");
        ObjectNode profile = object(doc.get("profile"), "个人信息", "name", "role", "phone", "email", "city", "website", "summary");
        string(profile, "name", 80);
        string(profile, "role", 160);
        string(profile, "phone", 80);
        string(profile, "email", 254);
        string(profile, "city", 160);
        string(profile, "website", 500);
        string(profile, "summary", 4000);
        entries(doc.get("experiences"), "工作经历", "company", "role");
        entries(doc.get("education"), "教育经历", "school", "degree");
        entries(doc.get("projects"), "项目经历", "name", "role");
        string(doc, "skills", 2000);
        return doc;
    }

    private void entries(JsonNode value, String label, String first, String second) {
        if (value == null || !value.isArray() || value.size() > 20) fail(label + "需要是最多 20 条的列表。");
        Set<String> ids = new HashSet<>();
        for (JsonNode entry : value) {
            ObjectNode row = object(entry, label, "id", first, second, "period", "description");
            if (!ids.add(id(string(row, "id", 80)))) fail(label + "存在重复的条目标识。");
            string(row, first, 160);
            string(row, second, 160);
            string(row, "period", 160);
            string(row, "description", 4000);
        }
    }

    private ObjectNode object(JsonNode value, String label, String... fields) {
        if (!(value instanceof ObjectNode)) fail(label + "需要是对象。");
        Set<String> allowed = Set.of(fields);
        if (value.size() != allowed.size()) fail(label + "字段不完整或包含不支持的字段。");
        for (String field : allowed) if (!value.has(field)) fail(label + "缺少字段：" + field + "。");
        return (ObjectNode) value;
    }

    private String string(JsonNode object, String field, int maximum) {
        JsonNode value = object.get(field);
        if (value == null || !value.isTextual()) fail(field + "需要是文字。");
        if (value.textValue().length() > maximum) fail(field + "最多支持 " + maximum + " 个字符。");
        return value.textValue();
    }

    private void fail(String message) { throw new ApiException(HttpStatus.BAD_REQUEST, message); }
}
