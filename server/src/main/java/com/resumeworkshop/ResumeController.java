package com.resumeworkshop;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@ConditionalOnProperty(prefix = "resume.storage", name = "api-enabled", havingValue = "true")
public class ResumeController {
    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    private final ResumeRepository repository;
    private final ResumeValidator validator;

    public ResumeController(ResumeRepository repository, ResumeValidator validator) { this.repository = repository; this.validator = validator; }

    @GetMapping("/resumes")
    public List<ObjectNode> list() { return repository.list(); }

    @PutMapping(value = "/resumes/{id}", consumes = "application/json")
    public ObjectNode save(@PathVariable String id, @RequestBody com.fasterxml.jackson.databind.JsonNode document) {
        return repository.save(validator.validate(document, id));
    }

    @DeleteMapping("/resumes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) { repository.delete(validator.id(id)); }

    @PostMapping("/resumes/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ObjectNode duplicate(@PathVariable String id) {
        ObjectNode copy = repository.find(validator.id(id)).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "这份简历不存在。"));
        copy.put("id", UUID.randomUUID().toString());
        String title = copy.get("title").textValue();
        copy.put("title", title.substring(0, Math.min(title.length(), 95)) + " · 副本");
        copy.put("updatedAt", TIMESTAMP.format(Instant.now()));
        return repository.save(copy);
    }
}
