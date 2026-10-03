using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GraphFlow.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBoardCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_boards_OwnerId",
                table: "boards");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "boards",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "Novo board");

            migrationBuilder.CreateIndex(
                name: "IX_boards_OwnerId_UpdatedAt",
                table: "boards",
                columns: new[] { "OwnerId", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_boards_OwnerId_UpdatedAt",
                table: "boards");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "boards");

            migrationBuilder.CreateIndex(
                name: "IX_boards_OwnerId",
                table: "boards",
                column: "OwnerId");
        }
    }
}
