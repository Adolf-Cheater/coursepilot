const express = require('express');
const { Pool } = require('pg');
const app = express();

// Configure PostgreSQL connection
const pool = new Pool({
  user: 'main',
  host: 'general-usuage.chkscywoifga.us-east-2.rds.amazonaws.com',
  database: 'ratemycourse',
  password: 'Woshishabi2004!',
  port: 5432,
});

app.use(express.json());

app.post('/api/upload', async (req, res) => {
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      const uploadData = req.body;
      await processUpload(client, uploadData);
  
      await client.query('COMMIT');
      res.status(200).json({ message: 'Data uploaded successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error processing upload:', error);
      res.status(500).json({ error: 'An error occurred while processing the upload' });
    } finally {
      client.release();
    }
  });
  
  async function processUpload(client, data) {
    // Insert or get department
    const departmentResult = await client.query(
      'INSERT INTO departments (department_name, faculty) VALUES ($1, $2) ON CONFLICT (department_name, faculty) DO UPDATE SET department_name = EXCLUDED.department_name RETURNING department_id',
      [data.department, data.faculty]
    );
    const departmentId = departmentResult.rows[0].department_id;
  
    // Insert or get instructor
    const instructorResult = await client.query(
      'INSERT INTO instructors (first_name, last_name, department_id) VALUES ($1, $2, $3) ON CONFLICT (first_name, last_name, department_id) DO UPDATE SET first_name = EXCLUDED.first_name RETURNING instructor_id',
      [data.instructorFirstName, data.instructorLastName, departmentId]
    );
    const instructorId = instructorResult.rows[0].instructor_id;
  
    // Insert or get course
    const courseResult = await client.query(
      'INSERT INTO courses (course_code) VALUES ($1) ON CONFLICT (course_code) DO UPDATE SET course_code = EXCLUDED.course_code RETURNING course_id',
      [data.courseCode]
    );
    const courseId = courseResult.rows[0].course_id;
  
    // Insert course offering
    const offeringResult = await client.query(
      'INSERT INTO course_offerings (course_id, instructor_id, academic_year, course_type, section, class_size, response_count, process_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING offering_id',
      [courseId, instructorId, data.academicYear, data.courseType, data.section, data.classSize, data.responseCount, data.processDate]
    );
    const offeringId = offeringResult.rows[0].offering_id;
  
    // Process questions
    for (const question of data.questions) {
      // Insert or get question template
      const questionResult = await client.query(
        'INSERT INTO question_templates (question_text) VALUES ($1) ON CONFLICT (question_text) DO UPDATE SET question_text = EXCLUDED.question_text RETURNING question_id',
        [question.text]
      );
      const questionId = questionResult.rows[0].question_id;
  
      // Insert question response
      await client.query(
        'INSERT INTO question_responses (offering_id, question_id, strongly_disagree, disagree, neither, agree, strongly_agree, median) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [offeringId, questionId, question.stronglyDisagree, question.disagree, question.neither, question.agree, question.stronglyAgree, question.median]
      );
    }
  }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
