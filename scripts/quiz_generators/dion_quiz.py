import os
import json
import re

# --- STEP 1: Find the input file ---
input_file = None
for file in os.listdir('.'):
    if file.endswith('_rawd.txt'):
        input_file = file
        break

if input_file is None:
    print("No file ending with '_rawd.txt' found.")
    exit()

# --- STEP 2: Process raw file into temporary _dion.txt ---
output_dir = 'OutputFiles'
os.makedirs(output_dir, exist_ok=True)

with open(input_file, 'r') as f:
    raw_lines = f.readlines()

processed = []
current_idx = 0
correct_ans = []
skip = 0
in_question = False  # Track if we're processing a question

while current_idx < len(raw_lines):
    line = raw_lines[current_idx]
    stripped = line.strip()
    
    # Handle Domain section (skip Domain line and next line)
    if stripped == 'Domain':
        skip = 2  # Skip Domain line and the next line (domain description)
        current_idx += 1
        continue
    if skip > 0:
        skip -= 1
        current_idx += 1
        continue
        
    # Handle question start
    if re.match(r'Question \d+', stripped):
        in_question = True  # Mark next line as question content
        # Start a new question section
        if processed and not processed[-1].startswith("==="):
            processed.append("\n")  # Add separator between questions
        current_idx += 1
        continue
        
    if stripped in ['Your answer is incorrect', 'Incorrect']:
        current_idx += 1
        continue
        
    # Handle correct answers: Add answer to both choices and answers list
    if stripped in ['Your selection is correct', 'Correct answer', 'Your answer is correct']:
        current_idx += 1  # Skip marker line
        if current_idx < len(raw_lines):
            ans_line = raw_lines[current_idx]
            ans = ans_line.strip()
            correct_ans.append(ans)
            processed.append(ans_line)  # Add answer to choices
            current_idx += 1  # Move to next line
        continue
    
    if stripped == 'Overall explanation' and correct_ans:
        # Add delimiters for answers and explanation
        processed.append("===ANSWERS===\n")
        for ans in correct_ans:
            processed.append(f"{ans}\n")
        processed.append("===EXPLANATION===\n")
        correct_ans = []
        # Capture explanation text
        if current_idx + 1 < len(raw_lines):
            processed.append(raw_lines[current_idx + 1])
            current_idx += 2
        else:
            current_idx += 1
        in_question = False  # Reset question state
        continue
    
    # Process content based on question state
    if stripped:
        processed.append(line)
    current_idx += 1

# Write temporary file (preserved for debugging)
temp_file = os.path.join(output_dir, input_file.replace('_rawd.txt', '_dion.txt'))
with open(temp_file, 'w') as f:
    f.writelines(processed)

# --- STEP 3: Parse temporary file into JSON using delimiters ---
with open(temp_file, 'r') as f:
    lines = []
    for line in f:
        stripped_line = line.strip()
        if stripped_line:
            # Replace literal \n with actual newline character
            stripped_line = stripped_line.replace('\\n', '\n')
            lines.append(stripped_line)

quiz_data = []
current_q = {}
current_section = "question"  # question -> answers -> explanation

for line in lines:
    if line == "===ANSWERS===":
        current_section = "answers"
        continue
    elif line == "===EXPLANATION===":
        current_section = "explanation"
        continue
    
    if current_section == "question":
        if not current_q:
            current_q = {"q": line, "c": [], "a": [], "e": None}
        else:
            current_q["c"].append(line)
    elif current_section == "answers":
        current_q["a"].append(line)
    elif current_section == "explanation":
        current_q["e"] = re.sub(
            r'For support or reporting issues,.*?Thank you\.?', 
            '', 
            line, 
            flags=re.IGNORECASE | re.DOTALL
        ).strip()
        quiz_data.append(current_q)
        current_q = {}
        current_section = "question"

# --- STEP 4: Write JSON ---
output_file = os.path.join(output_dir, input_file.replace('_rawd.txt', '.json'))
with open(output_file, 'w') as f:
    json.dump(quiz_data, f, indent=2)

os.remove(temp_file)

print(f"JSON quiz saved to: {output_file}")