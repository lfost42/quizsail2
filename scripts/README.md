# Textbook Quiz Helper Scripts

These scripts were created to streamline the creation of online quizzes scraped from books and Udemy. I currently have one for Sybex (book) Practice Test's and Dion's Practice Exams on Udemy. I will make more as needed. I will not provide raw or json files. 

The majority of the work is copy and pasting these into a file and adding the appropriate suffix indicator and adding them to the quiz_generators folder. However, files will often require tweaking to get the appropriate result. For example, I needed to manually append lines when they began with an IP address so they weren't read as a new question. If you have any thoughts on improving this, send me a note. 

None of my scripts delete raw files. This is because I've had to go back and adjust them after creating the json file. 

### codify.py
* Takes a text input, wraps it in < code > tags, adds \n line breaks, and provides the output in a single line to paste back into your raw data file. These days I use Review Mode these days as it's easier to add code that way.

### sybex_q.py

* input file: txt that ends with _rawq
* Everything between Chapter and the next question line will be deleted. 
* Questions must be preceded by a number followed by a period and a space. 
* Numbers must not be equal to the immediately previous or next number. 
* Numbers do not need to be sequential or unique line the file. 

* Choice lines must be preceded with a single capital letter followed by a period and a space. 
* Everything between Chapter and the next question line will be deleted. 
* output file: will replace _rawq with _q

### sybex_a.py

* Input file: txt that ends with _rawa  
* Text should be numbered lines followed by the letter answer/s and explanation (copy and paste them from the appendix into a txt file). 
* The number will be moved to its own line preceded with a blank line. 
* A string of capital letters followed by a comma or period and a space will be read as a set of answers to the question and appear in its own line. 
* An answer indicator "-" will precede the answer line; commas and periods will be stripped.
* An explanation indicator "--" precede the explanation line.
* Explanations lines will be moved to the same line.
* Output file: will replace _rawa with _a

### sybex_quiz.py

I separated these into 2 steps to make it easier to troubleshoot if the _q and _a output files don't match for whatever reason. It may require adjusting to get it to work. Line numbers are provided if any issues found. 

* Input file: txt that ands with _a and _q (auto generated from sybex_a.py and sybex_q.py)
* The numbers in _a and _q must appear in the same order. 
* Questions from _q will be added as "q" items.
* Choices from _q will be added as "c" items.
* Answers from _a will be matched to the beginning letter of Choices from _q.
* Once the answer/s is matched to the choice/s, the answer will be added as "a" items.
* The explanation text will be added as an "e" item. 
* Both choice and answer letters are stripped before being added to the json file. 
* Both question and explanation indicators are stripped before being added to the json file. 
* Prompt to confirm it is ok to delete temporary files once json file is created. 
* Output file: file.json

### dion_quiz.py

* Input file: txt that ends with _rawm
* Takes the result text from Dion quizzes on Udemy and parses them into a quizsail json file. This has since been updated to handle most Udemy quizzes. 
* Parses the correct answer/s
* Output file: file.json

### Prerequisites

* python3

[Back to main](https://github.com/lfost42/quizsail2)