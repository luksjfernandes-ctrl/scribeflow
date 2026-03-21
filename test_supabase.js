const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tcafqdwxoewdritwozxf.supabase.co'\;
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYWZxZHd4b2V3ZHJpdHdvenhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjQ3MzEsImV4cCI6MjA4OTcwMDczMX0.glanBaKG1qAaYkYomoCdNrT4uusQ2iaN1oLWBR9VYOE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjects() {
  const { data, error } = await supabase.from('projects').select('*').limit(1);
  console.log('SELECT projects:', { data, error });
}

checkProjects();
