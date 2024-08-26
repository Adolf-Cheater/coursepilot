const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Use body-parser middleware to parse JSON bodies
app.use(bodyParser.json());

// Configure CORS options to allow requests from specific origins
const corsOptions = {
  origin: 'http://localhost:3000', // Allow only your frontend origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

// Enable CORS with the specified options
app.use(cors(corsOptions));

// Configure PostgreSQL connection
const pool = new Pool({
  user: 'main',
  host: 'your-rds-endpoint.amazonaws.com',
  database: 'ratemycourse',  // Ensure this is set to 'ratemycourse'
  password: 'your-password',
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

    // Handle bulk upload if data is an array, or single upload otherwise
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
    'INSERT INTO course_offerings (course_id, instructor_id, academic_year, course_type, section, class_size, response_count, process_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (course_id, instructor_id, academic_year, course_type, section) DO UPDATE SET class_size = EXCLUDED.class_size, response_count = EXCLUDED.response_count, process_date = EXCLUDED.process_date RETURNING offering_id',
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
      'INSERT INTO question_responses (offering_id, question_id, strongly_disagree, disagree, neither, agree, strongly_agree, median) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (offering_id, question_id) DO UPDATE SET strongly_disagree = EXCLUDED.strongly_disagree, disagree = EXCLUDED.disagree, neither = EXCLUDED.neither, agree = EXCLUDED.agree, strongly_agree = EXCLUDED.strongly_agree, median = EXCLUDED.median',
      [offeringId, questionId, question.stronglyDisagree, question.disagree, question.neither, question.agree, question.stronglyAgree, question.median]
    );
  }
}

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
