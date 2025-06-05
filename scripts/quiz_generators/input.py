# Handles question sets that are multi-line and preserves code blocks.
import re
import json

def parse_questions_to_json(input_file, output_json):
    # Read entire file content
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Preprocess code blocks: replace newlines with literal \n
    code_block_pattern = re.compile(r'<code>(.*?)</code>', re.DOTALL)
    def replace_code_block(match):
        inner_content = match.group(1)
        # Replace newlines with literal \n (two characters)
        inner_content = inner_content.replace('\n', r'\n')
        return f'<code>{inner_content}</code>'
    
    new_content = code_block_pattern.sub(replace_code_block, content)
    lines = new_content.splitlines()  # Split into lines for processing
    
    questions_list = []
    state = 'start'
    current_question_lines = []
    current_choices = []
    current_choice = None
    current_answer_letters = None
    current_question_number = None
    current_explanation_lines = []
    
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped_line = line.strip()  # For pattern matching
        
        # Skip "Hide Solution" lines
        if re.fullmatch(r'Hide Solution\.?', stripped_line, re.IGNORECASE):
            index += 1
            continue
        
        if state == 'start':
            match_question = re.match(r'^Question\s+#?(\d+):', stripped_line)
            if match_question:
                state = 'question'
                current_question_number = match_question.group(1)
                rest = line[len(match_question.group(0)):]
                if rest:
                    current_question_lines.append(rest)
            else:
                match_question_no_colon = re.match(r'^Question\s+#?(\d+)\b', stripped_line)
                if match_question_no_colon:
                    state = 'question'
                    current_question_number = match_question_no_colon.group(1)
                elif state == 'start':
                    match_numbered = re.match(r'^(\d+)\.\s', stripped_line)
                    if match_numbered:
                        state = 'question'
                        current_question_number = match_numbered.group(1)
                        rest = line[len(match_numbered.group(0)):]
                        if rest:
                            current_question_lines.append(rest)
        
        elif state == 'question':
            if re.match(r'^[A-Z][\s]*[.:]', stripped_line) or \
               re.match(r'^(Answer|Correct Answer):', stripped_line, re.IGNORECASE):
                state = 'choices'
                index -= 1  # Reprocess line in choices state
            else:
                if line:
                    current_question_lines.append(line)
        
        elif state == 'choices':
            if re.match(r'^(Answer|Correct Answer):', stripped_line, re.IGNORECASE):
                if current_choice is not None:
                    current_choices.append(current_choice)
                    current_choice = None
                answer_str = re.sub(r'^(Answer|Correct Answer):\s*', '', stripped_line, flags=re.IGNORECASE)
                current_answer_letters = re.findall(r'[A-Z]', answer_str)
                state = 'after_answer'
            elif re.match(r'^[A-Z][\s]*[.:]', stripped_line):
                if current_choice is not None: 
                    current_choices.append(current_choice)
                pattern = r'^\s*[A-Z][\s]*[.:][\s]*'
                choice_text = re.sub(pattern, '', line, count=1).lstrip()
                current_choice = choice_text
            else:
                if current_choice is not None:
                    current_choice += ' ' + line.strip()
        
        elif state == 'after_answer':
            if re.match(r'^Explanation:', stripped_line, re.IGNORECASE):
                exp_part = re.sub(r'^Explanation:\s*', '', line, flags=re.IGNORECASE)
                if exp_part:
                    current_explanation_lines.append(exp_part)
                state = 'explanation'
            else:
                state = 'done'
                index -= 1  # Reprocess current line
        
        elif state == 'explanation':
            next_question = (
                re.match(r'^Question\s+\d+:', stripped_line) or 
                re.match(r'^\d+\.\s', stripped_line)
            )
            if not stripped_line or next_question:
                state = 'done'
                index -= 1
            else:
                current_explanation_lines.append(line)  # Preserve spaces
        
        if state == 'done':
            # Join question lines with spaces
            question_text = ' '.join(current_question_lines).strip()
            
            # Process choices
            choices_clean = []
            for choice in current_choices:
                clean_choice = choice.replace('<code>', '').replace('</code>', '')
                choices_clean.append(clean_choice)
            
            answers_clean = []
            if current_answer_letters:
                for letter in current_answer_letters:
                    idx = ord(letter) - ord('A')
                    if 0 <= idx < len(choices_clean):
                        answers_clean.append(choices_clean[idx])
            
            q_dict = {
                "q": question_text,
                "c": choices_clean,
                "a": answers_clean
            }
            if current_explanation_lines:
                # Join explanation lines with spaces and remove code tags
                explanation_text = ' '.join(current_explanation_lines).strip()
                explanation_text = explanation_text.replace('<code>', '').replace('</code>', '')
                q_dict["e"] = explanation_text
            
            questions_list.append(q_dict)
            
            # Reset state
            state = 'start'
            current_question_lines = []
            current_choices = []
            current_choice = None
            current_answer_letters = None
            current_question_number = None
            current_explanation_lines = []
        
        index += 1
    
    # Handle last question if file ends without trailing newline
    if state != 'start':
        question_text = ' '.join(current_question_lines).strip()
        choices_clean = current_choices
        
        answers_clean = []
        if current_answer_letters:
            for letter in current_answer_letters:
                idx = ord(letter) - ord('A')
                if 0 <= idx < len(choices_clean):
                    answers_clean.append(choices_clean[idx])
        
        q_dict = {
            "q": question_text,
            "c": choices_clean,
            "a": answers_clean
        }
        if current_explanation_lines:
            q_dict["e"] = ' '.join(current_explanation_lines).strip()
        
        questions_list.append(q_dict)
    
    # Manually write JSON with proper newline handling
    with open(output_json, 'w') as f:
        f.write('[\n')
        for i, q in enumerate(questions_list):
            if i > 0:
                f.write(',\n')
            
            # Start building the question entry
            output = '    {\n'
            
            # Add question with direct string formatting
            q_str = q['q'].replace('"', '\\"')  # Escape double quotes
            output += f'        "q": "{q_str}",\n'
            
            # Add choices with json.dumps to handle list formatting
            c_str = json.dumps(q['c'], ensure_ascii=False)
            output += f'        "c": {c_str},\n'
            
            # Add answers
            a_str = json.dumps(q['a'], ensure_ascii=False)
            output += f'        "a": {a_str}'
            
            # Add explanation if it exists
            if 'e' in q:
                e_str = q['e'].replace('"', '\\"')  # Escape double quotes
                output += f',\n        "e": "{e_str}"'
            
            output += '\n    }'
            f.write(output)
        
        f.write('\n]')

if __name__ == "__main__":
    input_filename = 'input.txt'
    output_json_filename = 'output.json'
    parse_questions_to_json(input_filename, output_json_filename)