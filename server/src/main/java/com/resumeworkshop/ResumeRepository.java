package com.resumeworkshop;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@ConditionalOnProperty(prefix = "resume.storage", name = "api-enabled", havingValue = "true")
public class ResumeRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ResumeRepository(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    public List<ObjectNode> list() {
        return jdbc.query("SELECT payload FROM resumes ORDER BY updated_at DESC, id", (row, index) -> decode(row.getString(1)));
    }

    public Optional<ObjectNode> find(String id) {
        return jdbc.query("SELECT payload FROM resumes WHERE id = ?", (row, index) -> decode(row.getString(1)), id).stream().findFirst();
    }

    // This prototype runs as one local process; synchronize the count and insertion together.
    public synchronized ObjectNode save(ObjectNode doc) {
        String id = doc.get("id").textValue();
        if (find(id).isEmpty() && jdbc.queryForObject("SELECT COUNT(*) FROM resumes", Integer.class) >= 50) {
            throw new ApiException(HttpStatus.CONFLICT, "最多可保存 50 份简历，请先备份并删除暂时不用的简历。");
        }
        jdbc.update("MERGE INTO resumes (id, payload, updated_at) KEY(id) VALUES (?, ?, ?)",
                id, doc.toString(), doc.get("updatedAt").textValue());
        return doc;
    }

    public void delete(String id) { jdbc.update("DELETE FROM resumes WHERE id = ?", id); }

    private ObjectNode decode(String json) {
        try { return (ObjectNode) mapper.readTree(json); }
        catch (JsonProcessingException | ClassCastException e) { throw new IllegalStateException("Stored resume is invalid", e); }
    }
}
