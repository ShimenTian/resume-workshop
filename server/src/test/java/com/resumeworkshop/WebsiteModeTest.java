package com.resumeworkshop;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:unavailable:website-mode-does-not-use-a-database")
@AutoConfigureMockMvc
class WebsiteModeTest {
    @Autowired MockMvc mvc;
    @Autowired ApplicationContext context;

    @Test
    void defaultWebsiteModeKeepsHealthAndDisablesAllResumeOperations() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        mvc.perform(get("/api/resumes")).andExpect(status().isNotFound());
        mvc.perform(put("/api/resumes/private-resume").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/resumes/private-resume")).andExpect(status().isNotFound());
        mvc.perform(post("/api/resumes/private-resume/duplicate")).andExpect(status().isNotFound());
    }

    @Test
    void defaultWebsiteModeDoesNotInitializeDatabaseOrRegisterLegacyStorageBeans() {
        assertThat(context.getBeansOfType(DataSource.class)).isEmpty();
        assertThat(context.getBeansOfType(JdbcTemplate.class)).isEmpty();
        assertThat(context.getBeansOfType(ResumeRepository.class)).isEmpty();
        assertThat(context.getBeansOfType(ResumeController.class)).isEmpty();
    }
}
