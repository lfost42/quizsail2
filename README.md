# QuizSail
Test Prep Engine, forked from https://github.com/jmatzen/quizsail. I started to need some additional functionality as I started to utilize this for other certificaiton exams, most notably CompTIA. I needed a way to scrape questions from a book and create quizzes out of them, especially when the questions and answers were in different places (looking at you, Sybex!). 

### QuizSail contains a test prep engine with scripts to create your own quizzes from various sources.
The test prep engine uses a technique called *assumed competency*.  This technique assumes that if you answer the question correctly the first time that you already know the answer. Because of this, it's running on sort of an honor system, so if the user is not sure what the answer is they should not enter any answer at all instead of guessing.

QuizSail's competency system works by holding a certain number of questions from the pool in-flight.  Once the user has correctly answered a question in the in-flight state so many times in a row, the question is moved to the completed state and is not asked again.  As long as the in-flight pool is full, the next question to appear is randomly selected from the questions in the pool that aged the most so that the same question is not likely to be asked twice in a row.

## List of updates for QuizSail 2.0
* [Script](scripts/explanation_adder/) to add an json line item for explanations to any working json file.
* Explanations added to the result if available (need to populate the "e" item in the json file).
* [Scripts](scripts/quiz_generators) to create a new quiz json files with appropriately formatted question/answer files. See [instructions](scripts/README.md) for more info.

* New quizzes are dynamically loaded to start menu (add them to the public folder).
* Ability to add line breaks (\n) in the json file.
* Text font switches to monotype when wrapped in < code > tags.

* Avoids giving the same question twice in a row (mostly) unless it's the last question.
* Upon completion of a quiz, the session is deleted and you are returned to the main page.
* Delete all sessions option added.

## Getting Started
These instructions will get you a copy of the project up and running on your local machine.

### Prerequisites
* node

### Installing and Running
* Clone this repo.
* Open a terminal at the folder
* Run `npm update`
* Run `npm install`
* Run `npm start`
* Open your browser and enter ```http://localhost:3000``

## Deployment Notes
`docker build -t quizsail .`
`docker run --mount 'type=volume,src=quizsail,dst=/usr/src/app/data' --restart=always -i -p 49000:3000 -d quizsail`

## Contributing
Use pull requests.

## Authors
* **John Matzen** - *Initial work* - [jmatzen](https://github.com/jmatzen)
* L S - *Some CSS, HTML, JS* - [SkillAllHumans](https://github.com/SkillAllHumans)
* lynda_ - *c191 data*

## License
This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
