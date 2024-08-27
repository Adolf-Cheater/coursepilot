const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Use body-parser middleware to parse JSON bodies
app.use(bodyParser.json());

app.use(cors());

// Configure PostgreSQL connection
const pool = new Pool({
  user: 'main',
  host: 'general-usuage.chkscywoifga.us-east-2.rds.amazonaws.com',
  database: 'ratemycourse',
  password: 'Woshishabi2004!',
  port: 5432,
  ssl: {
    rejectUnauthorized: false  // Ensure SSL is properly configured
  }
});

// Root route for basic health check
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Data upload endpoint
app.post('/api/upload', async (req, res) => {
  console.log('Attempting to connect to database:', pool.options.database);
  console.log('Using database host:', pool.options.host);

  const client = await pool.connect();

  try {
    console.log('Successfully connected to the database.');
    await client.query('BEGIN');

    const uploadData = req.body;

    if (Array.isArray(uploadData)) {
      for (const data of uploadData) {
        await processUpload(client, data);
      }
    } else {
      await processUpload(client, uploadData);
    }

    await client.query('COMMIT');
    console.log('Data uploaded successfully');
    res.status(200).json({ message: 'Data uploaded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'An error occurred while processing the upload: ' + error.message });
  } finally {
    client.release();
    console.log('Database connection released.');
  }
});

// Function to process individual upload data
async function processUpload(client, data) {
  // Insert or get department
  const departmentResult = await client.query(
    `INSERT INTO departments (department_name, faculty) 
     VALUES ($1, $2) 
     ON CONFLICT (department_name, faculty) DO UPDATE 
     SET department_name = EXCLUDED.department_name 
     RETURNING department_id`,
    [data.department, data.faculty]
  );
  const departmentId = departmentResult.rows[0].department_id;

  // Insert or get instructor
  const instructorResult = await client.query(
    `INSERT INTO instructors (first_name, last_name, department_id) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (first_name, last_name, department_id) DO UPDATE 
     SET first_name = EXCLUDED.first_name 
     RETURNING instructor_id`,
    [data.instructorFirstName, data.instructorLastName, departmentId]
  );
  const instructorId = instructorResult.rows[0].instructor_id;

  // Insert or get course
  const courseResult = await client.query(
    `INSERT INTO courses (course_code, course_name) 
     VALUES ($1, $2) 
     ON CONFLICT (course_code) DO UPDATE 
     SET course_name = EXCLUDED.course_name 
     RETURNING course_id`,
    [data.courseCode, data.courseName]
  );
  const courseId = courseResult.rows[0].course_id;

  if (data.courseType === 'LEC') {
    // Insert lecture offering
    const offeringResult = await client.query(
      `INSERT INTO course_offerings (course_id, instructor_id, academic_year, course_type, section, class_size, response_count, process_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (course_id, instructor_id, academic_year, course_type, section) DO UPDATE 
       SET class_size = EXCLUDED.class_size, response_count = EXCLUDED.response_count, process_date = EXCLUDED.process_date 
       RETURNING offering_id`,
      [courseId, instructorId, data.academicYear, data.courseType, data.section, data.classSize, data.responseCount, data.processDate]
    );
    const offeringId = offeringResult.rows[0].offering_id;

    // Process questions
    for (const question of data.questions) {
      // Insert or get question template
      const questionResult = await client.query(
        `INSERT INTO question_templates (question_text) 
         VALUES ($1) 
         ON CONFLICT (question_text) DO UPDATE 
         SET question_text = EXCLUDED.question_text 
         RETURNING question_id`,
        [question.text]
      );
      const questionId = questionResult.rows[0].question_id;

      // Insert question response for lecture
      await client.query(
        `INSERT INTO question_responses (offering_id, question_id, strongly_disagree, disagree, neither, agree, strongly_agree, median) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT (offering_id, question_id) DO UPDATE 
         SET strongly_disagree = EXCLUDED.strongly_disagree, disagree = EXCLUDED.disagree, neither = EXCLUDED.neither, agree = EXCLUDED.agree, strongly_agree = EXCLUDED.strongly_agree, median = EXCLUDED.median`,
        [offeringId, questionId, question.stronglyDisagree, question.disagree, question.neither, question.agree, question.stronglyAgree, question.median]
      );
    }
  } else if (data.courseType === 'LAB') {
    // Insert lab offering
    const labOfferingResult = await client.query(
      `INSERT INTO lab_offerings (course_id, instructor_id, academic_year, lab_section, lab_size, lab_response_count, lab_process_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (course_id, instructor_id, academic_year, lab_section) DO UPDATE 
       SET lab_size = EXCLUDED.lab_size, lab_response_count = EXCLUDED.lab_response_count, lab_process_date = EXCLUDED.lab_process_date 
       RETURNING lab_offering_id`,
      [courseId, instructorId, data.academicYear, data.section, data.classSize, data.responseCount, data.processDate]
    );
    const labOfferingId = labOfferingResult.rows[0].lab_offering_id;

    // Process questions
    for (const question of data.questions) {
      // Insert or get question template
      const questionResult = await client.query(
        `INSERT INTO question_templates (question_text) 
         VALUES ($1) 
         ON CONFLICT (question_text) DO UPDATE 
         SET question_text = EXCLUDED.question_text 
         RETURNING question_id`,
        [question.text]
      );
      const questionId = questionResult.rows[0].question_id;

      // Insert question response for lab
      await client.query(
        `INSERT INTO question_responses (lab_offering_id, question_id, strongly_disagree, disagree, neither, agree, strongly_agree, median) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT (lab_offering_id, question_id) DO UPDATE 
         SET strongly_disagree = EXCLUDED.strongly_disagree, disagree = EXCLUDED.disagree, neither = EXCLUDED.neither, agree = EXCLUDED.agree, strongly_agree = EXCLUDED.strongly_agree, median = EXCLUDED.median`,
        [labOfferingId, questionId, question.stronglyDisagree, question.disagree, question.neither, question.agree, question.stronglyAgree, question.median]
      );
    }
  }
}

// New retrieval endpoint for searching by course code or professor name
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  const client = await pool.connect();

  try {
    const searchPattern = `%${query}%`;

    // Queries to fetch matching courses and professors
    const courseQuery = `
      SELECT course_code, course_name
      FROM courses
      WHERE course_code ILIKE $1 OR course_name ILIKE $1
      LIMIT 10
    `;

    const professorQuery = `
      SELECT i.first_name, i.last_name, d.department_name
      FROM instructors i
      JOIN departments d ON i.department_id = d.department_id
      WHERE i.first_name ILIKE $1 OR i.last_name ILIKE $1 OR CONCAT(i.first_name, ' ', i.last_name) ILIKE $1
      LIMIT 10
    `;

    const [courseResult, professorResult] = await Promise.all([
      client.query(courseQuery, [searchPattern]),
      client.query(professorQuery, [searchPattern])
    ]);

    res.json({
      courses: courseResult.rows,
      professors: professorResult.rows
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'An error occurred while fetching data.' });
  } finally {
    client.release();
  }
});

// Retrieve all courses and professors
app.get('/api/all-data', async (req, res) => {
  const client = await pool.connect();

  try {
    // Fetch all courses
    const coursesQuery = `
      SELECT course_code, course_name
      FROM courses
    `;
    const coursesResult = await client.query(coursesQuery);

    // Fetch all professors
    const professorsQuery = `
      SELECT i.first_name, i.last_name, d.department_name
      FROM instructors i
      JOIN departments d ON i.department_id = d.department_id
    `;
    const professorsResult = await client.query(professorsQuery);

    res.json({
      courses: coursesResult.rows,
      professors: professorsResult.rows
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'An error occurred while fetching data.' });
  } finally {
    client.release();
  }
});

// Course details endpoint
app.get('/api/course/:courseCode', async (req, res) => {
  const { courseCode } = req.params;
  const client = await pool.connect();

  try {
    const courseQuery = `
      SELECT 
        c.course_code, 
        c.course_name, 
        i.first_name, 
        i.last_name, 
        d.department_name, 
        co.academic_year, 
        co.course_type, 
        co.section, 
        co.class_size, 
        co.response_count, 
        co.process_date,
        co.offering_id,
        'LEC' as offering_type,
        AVG(qr.median) as average_median
      FROM 
        courses c
      JOIN 
        course_offerings co ON c.course_id = co.course_id
      JOIN 
        instructors i ON co.instructor_id = i.instructor_id
      JOIN 
        departments d ON i.department_id = d.department_id
      LEFT JOIN 
        question_responses qr ON co.offering_id = qr.offering_id
      WHERE 
        c.course_code = $1
      GROUP BY 
        c.course_code, 
        c.course_name, 
        i.first_name, 
        i.last_name, 
        d.department_name, 
        co.academic_year, 
        co.course_type, 
        co.section, 
        co.class_size, 
        co.response_count, 
        co.process_date,
        co.offering_id
      
      UNION ALL

      SELECT 
        c.course_code, 
        c.course_name, 
        i.first_name, 
        i.last_name, 
        d.department_name, 
        lo.academic_year, 
        'LAB' as course_type, 
        lo.lab_section as section, 
        lo.lab_size as class_size, 
        lo.lab_response_count as response_count, 
        lo.lab_process_date as process_date,
        lo.lab_offering_id as offering_id,
        'LAB' as offering_type,
        AVG(qr.median) as average_median
      FROM 
        courses c
      JOIN 
        lab_offerings lo ON c.course_id = lo.course_id
      JOIN 
        instructors i ON lo.instructor_id = i.instructor_id
      JOIN 
        departments d ON i.department_id = d.department_id
      LEFT JOIN 
        question_responses qr ON lo.lab_offering_id = qr.lab_offering_id
      WHERE 
        c.course_code = $1
      GROUP BY 
        c.course_code, 
        c.course_name, 
        i.first_name, 
        i.last_name, 
        d.department_name, 
        lo.academic_year, 
        lo.lab_section, 
        lo.lab_size, 
        lo.lab_response_count, 
        lo.lab_process_date,
        lo.lab_offering_id
      ORDER BY 
        academic_year DESC, section ASC
    `;

    const result = await client.query(courseQuery, [courseCode]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseOfferings = result.rows;

    // Process questions for each offering
    for (const offering of courseOfferings) {
      const questionsQuery = `
        SELECT 
          qt.question_text, 
          qr.strongly_disagree, 
          qr.disagree, 
          qr.neither, 
          qr.agree, 
          qr.strongly_agree, 
          qr.median
        FROM 
          question_responses qr
        JOIN 
          question_templates qt ON qr.question_id = qt.question_id
        WHERE 
          qr.${offering.offering_type === 'LEC' ? 'offering_id' : 'lab_offering_id'} = $1
      `;
      const questionsResult = await client.query(questionsQuery, [offering.offering_id]);
      offering.questions = questionsResult.rows;
    }

    res.json(courseOfferings);
  } catch (error) {
    console.error('Error fetching course details:', error);
    res.status(500).json({ error: 'An error occurred while fetching course details.' });
  } finally {
    client.release();
  }
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
