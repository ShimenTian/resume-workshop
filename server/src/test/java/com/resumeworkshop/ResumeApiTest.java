package com.resumeworkshop;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "resume.storage.api-enabled=true")
@AutoConfigureMockMvc
class ResumeApiTest {
    private static final Path DATABASE = temporaryDirectory().resolve("resumes");
    private static final String URL = "jdbc:h2:file:" + DATABASE + ";DB_CLOSE_ON_EXIT=FALSE";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) { properties.add("spring.datasource.url", () -> URL); }

    @BeforeEach
    void clean() { jdbc.update("DELETE FROM resumes"); }

    @Test
    void savesUpdatesListsDuplicatesAndDeletes() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        ObjectNode original = document("resume-1");
        mvc.perform(put("/api/resumes/resume-1").contentType(MediaType.APPLICATION_JSON).content(original.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profile.name").value("林知夏"));
        original.put("title", "新的简历名称");
        mvc.perform(put("/api/resumes/resume-1").contentType(MediaType.APPLICATION_JSON).content(original.toString()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/resumes")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("新的简历名称"));
        String response = mvc.perform(post("/api/resumes/resume-1/duplicate")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("新的简历名称 · 副本")).andExpect(jsonPath("$.id", not("resume-1")))
                .andReturn().getResponse().getContentAsString();
        String copiedId = mapper.readTree(response).get("id").textValue();
        mvc.perform(get("/api/resumes")).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(delete("/api/resumes/resume-1")).andExpect(status().isNoContent());
        mvc.perform(get("/api/resumes")).andExpect(jsonPath("$[0].id").value(copiedId));
        mvc.perform(delete("/api/resumes/absent")).andExpect(status().isNoContent());
    }

    @Test
    void dataIsCommittedToAFileDatabaseAndVisibleFromAnotherConnection() throws Exception {
        mvc.perform(put("/api/resumes/persistent").contentType(MediaType.APPLICATION_JSON).content(document("persistent").toString()))
                .andExpect(status().isOk());
        assertThat(Path.of(DATABASE + ".mv.db")).isRegularFile();
        try (var connection = DriverManager.getConnection(URL, "sa", "");
             var statement = connection.prepareStatement("SELECT payload FROM resumes WHERE id = ?")) {
            statement.setString(1, "persistent");
            try (var result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(mapper.readTree(result.getString(1)).get("profile").get("name").textValue()).isEqualTo("林知夏");
            }
        }
    }

    @Test
    void rejectsInvalidDocumentsWithoutOverwritingSavedData() throws Exception {
        ObjectNode doc = document("resume-1");
        mvc.perform(put("/api/resumes/resume-1").contentType(MediaType.APPLICATION_JSON).content(doc.toString())).andExpect(status().isOk());
        doc.put("id", "other");
        mvc.perform(put("/api/resumes/resume-1").contentType(MediaType.APPLICATION_JSON).content(doc.toString())).andExpect(status().isBadRequest());
        doc.put("id", "resume-1");
        doc.put("unexpected", true);
        mvc.perform(put("/api/resumes/resume-1").contentType(MediaType.APPLICATION_JSON).content(doc.toString())).andExpect(status().isBadRequest());
        doc.remove("unexpected");
        doc.withObject("/profile").put("name", "长".repeat(81));
        mvc.perform(put("/api/resumes/resume-1").contentType(MediaType.APPLICATION_JSON).content(doc.toString())).andExpect(status().isBadRequest());
        mvc.perform(get("/api/resumes")).andExpect(jsonPath("$[0].profile.name").value("林知夏"));
    }

    @Test
    void rejectsMalformedJsonTrailingDataAndOversizedBodies() throws Exception {
        mvc.perform(put("/api/resumes/x").contentType(MediaType.APPLICATION_JSON).content("{broken"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").exists()).andExpect(jsonPath("$.trace").doesNotExist());
        mvc.perform(put("/api/resumes/x").contentType(MediaType.APPLICATION_JSON).content(document("x") + " {}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/resumes/x").contentType(MediaType.APPLICATION_JSON).content(" ".repeat(RequestLimitFilter.MAX_CHARACTERS + 1)))
                .andExpect(status().isPayloadTooLarge());
        mvc.perform(put("/api/resumes/x").contentType(MediaType.APPLICATION_JSON).content(" ".repeat(RequestLimitFilter.MAX_BYTES + 1)))
                .andExpect(status().isPayloadTooLarge());
        mvc.perform(put("/api/resumes/x").contentType(MediaType.TEXT_PLAIN).content(document("x").toString()))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void validatesDatesListsIdsAndMissingRecords() throws Exception {
        ObjectNode doc = document("x");
        doc.put("updatedAt", "2026-02-30T00:00:00.000Z");
        mvc.perform(put("/api/resumes/x").contentType(MediaType.APPLICATION_JSON).content(doc.toString())).andExpect(status().isBadRequest());
        doc = document("x");
        doc.withArray("experiences").addObject().put("id", "row-1").put("company", "公司").put("role", "工程师").put("period", "2026").put("description", "示例");
        doc.withArray("experiences").add(doc.withArray("experiences").get(0).deepCopy());
        mvc.perform(put("/api/resumes/x").contentType(MediaType.APPLICATION_JSON).content(doc.toString())).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/resumes/illegal.id")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/resumes/missing/duplicate")).andExpect(status().isNotFound());
    }

    @Test
    void enforcesDocumentCountAndAllowsExistingDocumentUpdates() throws Exception {
        for (int index = 0; index < 50; index++) {
            String id = "resume-" + index;
            jdbc.update("INSERT INTO resumes (id,payload,updated_at) VALUES (?,?,?)", id, document(id).toString(), "2026-09-25T00:00:00.000Z");
        }
        mvc.perform(put("/api/resumes/overflow").contentType(MediaType.APPLICATION_JSON).content(document("overflow").toString()))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/resumes/resume-0/duplicate")).andExpect(status().isConflict());
        mvc.perform(put("/api/resumes/resume-0").contentType(MediaType.APPLICATION_JSON).content(document("resume-0").toString()))
                .andExpect(status().isOk());
    }

    @Test
    void onlyAllowsLocalFrontendCorsOrigins() throws Exception {
        mvc.perform(options("/api/resumes/x").header("Origin", "http://localhost:5174")
                .header("Access-Control-Request-Method", "PUT").header("Access-Control-Request-Headers", "Content-Type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5174"));
        mvc.perform(options("/api/resumes/x").header("Origin", "https://example.com").header("Access-Control-Request-Method", "PUT"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(post("/api/resumes/x/duplicate").header("Origin", "https://example.com"))
                .andExpect(status().isForbidden());
    }

    private ObjectNode document(String id) throws Exception {
        ObjectNode doc = (ObjectNode) mapper.readTree("""
            {"id":"x","title":"我的简历","updatedAt":"2026-09-25T00:00:00.000Z","templateId":"classic","accent":"#59745d",
             "profile":{"name":"林知夏","role":"产品经理","phone":"","email":"","city":"","website":"","summary":""},
             "experiences":[],"education":[],"projects":[],"skills":""}
            """);
        doc.put("id", id);
        return doc;
    }

    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("resume-api-test-"); }
        catch (IOException error) { throw new IllegalStateException(error); }
    }
}
