document.addEventListener("DOMContentLoaded", () => {
  const player = document.getElementById("player");
  const obstacle = document.getElementById("obstacle");
  const scoreDisplay = document.getElementById("score");
  const leaderboard = document.getElementById("leaderboard");

  let isJumping = false;
  let score = 0;
  let gameSpeed = 5;
  let isGameRunning = true;

  function jump() {
    if (isJumping || !isGameRunning) return;
    isJumping = true;

    let pos = 0;
    const jumpInterval = setInterval(() => {
      if (pos >= 100) {
        clearInterval(jumpInterval);
        const fall = setInterval(() => {
          if (pos <= 0) {
            clearInterval(fall);
            isJumping = false;
          } else {
            pos -= 5;
            player.style.bottom = 50 + pos + "px";

          }
        }, 20);
      } else {
        pos += 5;
        player.style.bottom = 50 + pos + "px";
      }
    }, 20);
  }

  function spawnObstacle() {
  const height = Math.floor(Math.random() * 30) + 20; // height between 20–50px
  const width = Math.floor(Math.random() * 30) + 20;

  obstacle.style.height = `${height}px`;
  obstacle.style.width = `${width}px`;
  obstacle.style.left = window.innerWidth + "px"; // spawn off-screen to the right
  obstacle.style.bottom = "50px"; // same bottom as player
}


  function animateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
    scoreDisplay.style.transform = "scale(1.3)";
    scoreDisplay.style.transition = "transform 0.1s ease";
    setTimeout(() => {
      scoreDisplay.style.transform = "scale(1)";
    }, 100);
  }

  function checkCollision() {
    const playerRect = player.getBoundingClientRect();
    const obstacleRect = obstacle.getBoundingClientRect();

    return !(
      playerRect.top > obstacleRect.bottom ||
      playerRect.bottom < obstacleRect.top ||
      playerRect.right < obstacleRect.left ||
      playerRect.left > obstacleRect.right
    );
  }

  function updateLeaderboard(score) {
    let scores = JSON.parse(localStorage.getItem("jumpScores")) || [];
    scores.push(score);
    scores = scores.sort((a, b) => b - a).slice(0, 5);
    localStorage.setItem("jumpScores", JSON.stringify(scores));

    leaderboard.innerHTML = "<strong>Leaderboard</strong><br>" +
      scores.map((s, i) => `${i + 1}. ${s}`).join("<br>");
  }

  function gameLoop() {
    spawnObstacle();

    const moveObstacle = setInterval(() => {
      const currentLeft = parseInt(obstacle.style.left);
      if (isNaN(currentLeft)) return;

      obstacle.style.left = (currentLeft - gameSpeed) + "px";

      if (checkCollision()) {
        clearInterval(moveObstacle);
        isGameRunning = false;
        hitSound.play();
        alert("Game Over! Your score: " + score);
        updateLeaderboard(score);
        return;
      }

      if (currentLeft + obstacle.offsetWidth < 0) {
        clearInterval(moveObstacle);
        score++;
        gameSpeed += 0.3;
        animateScore();
        gameLoop(); // spawn next obstacle
      }
    }, 20);
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      jump();
    }
  });

  spawnObstacle();
  gameLoop();
});
