from flask import Flask, render_template, request, jsonify
from game import play

app = Flask(__name__)

player_score = 0
computer_score = 0


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/play", methods=["POST"])
def play_game():
    global player_score, computer_score

    data = request.get_json()
    user_choice = data["choice"]

    game = play(user_choice)

    if game["result"] == "You Win":
        player_score += 1
    elif game["result"] == "Computer Wins":
        computer_score += 1

    winner = None

    if player_score == 3:
        winner = "Player"

    elif computer_score == 3:
        winner = "Computer"

    return jsonify({
        "user": game["user"],
        "computer": game["computer"],
        "result": game["result"],
        "player_score": player_score,
        "computer_score": computer_score,
        "winner": winner
    })


@app.route("/reset", methods=["POST"])
def reset():
    global player_score, computer_score

    player_score = 0
    computer_score = 0

    return jsonify({"message": "Game Reset"})


if __name__ == "__main__":
    app.run(debug=True)