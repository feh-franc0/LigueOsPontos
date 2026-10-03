using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GraphFlow.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SetBoardTitleDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE boards SET \"Title\" = 'Novo board' WHERE \"Title\" = '';");
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "boards",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "Novo board",
                oldClrType: typeof(string),
                oldType: "character varying(160)",
                oldMaxLength: 160);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "boards",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(160)",
                oldMaxLength: 160,
                oldDefaultValue: "Novo board");
        }
    }
}
